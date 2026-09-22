from __future__ import annotations

from datetime import date
import csv
import io
import os
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .database import audit, connect, init_db, rows_to_dicts
from .schemas import (
    ApplicationCreate,
    AssessmentRecordPatch,
    AttendanceRecordPatch,
    LoginRequest,
    PasswordChangeRequest,
    MeetingCreate,
    StaffUserCreate,
    StatusPatch,
    StudentPatch,
    TuitionRecordPatch,
)
from .provision_teachers import STAFF_ACCOUNTS, enforce_staff_access, provision_from_env
from .security import create_token, decode_token, hash_password, validate_security_config, verify_password

app = FastAPI(title="ABA Academy API", version="1.0.0")

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://abaacademy.vercel.app",
]

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_URLS", ",".join(DEFAULT_ALLOWED_ORIGINS)).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    validate_security_config()
    init_db()
    provision_from_env()
    enforce_staff_access()


def student_row(row):
    data = dict(row)
    return {
        "id": data["id"],
        "name": data["name"],
        "age": data["age"],
        "parentName": data["parent_name"],
        "parentPhone": data["parent_phone"],
        "address": data["address"],
        "klass": data["klass"],
        "teacher": data["teacher"],
        "stars": data["stars"],
        "hw": data["hw"],
        "attendance": data["attendance"],
        "nextHw": data["next_hw"],
        "attendancePct": data["attendance_pct"],
        "performance": data["performance"],
        "homeworkAvg": data["homework_avg"],
        "overall": data["overall"],
        "status": data["status"],
        "rank": data["rank"],
        "tuitionStatus": data["tuition_status"],
        "amountDue": data["amount_due"],
        "joinedDate": data.get("joined_date", ""),
        "enrollmentStatus": data.get("enrollment_status", "active"),
        "financeNote": data.get("finance_note", ""),
        "terminationNote": data.get("termination_note", ""),
    }


def application_row(row):
    data = dict(row)
    return {
        "id": data["id"],
        "name": data["name"],
        "age": data["age"],
        "parentName": data["parent_name"],
        "parentSurname": data["parent_surname"],
        "email": data.get("email", ""),
        "phone": data["phone"],
        "address": data["address"],
        "program": data["program"],
        "teacher": data["teacher"],
        "klass": data["klass"],
        "submitted": data["submitted"],
        "status": data["status"],
        "emergencyContact1Name": data.get("emergency_contact1_name", ""),
        "emergencyContact1Phone": data.get("emergency_contact1_phone", ""),
        "emergencyContact1Relation": data.get("emergency_contact1_relation", ""),
        "emergencyContact2Name": data.get("emergency_contact2_name", ""),
        "emergencyContact2Phone": data.get("emergency_contact2_phone", ""),
        "emergencyContact2Relation": data.get("emergency_contact2_relation", ""),
        "parentTelegram": data.get("parent_telegram", ""),
    }


def group_row(row):
    data = dict(row)
    return {
        "id": data["id"],
        "name": data["name"],
        "teacher": data["teacher"],
        "program": data["program"],
        "schedule": data["schedule"],
        "capacity": data["capacity"],
        "enrolled": data["enrolled"],
    }


def staff_row(row):
    data = dict(row)
    return {
        "id": data["id"],
        "name": data["name"],
        "role": data["role"],
        "email": data["email"],
        "status": data["status"],
        "lastActive": data["last_active"],
    }


def auth_user_row(row):
    data = dict(row)
    return {
        "id": data["staff_user_id"],
        "name": data["name"],
        "email": data["email"],
        "role": data["role"],
        "status": data["status"],
        "mustChangePassword": bool(data["must_change_password"]),
    }


def meeting_row(row):
    data = dict(row)
    return {
        "id": data["id"],
        "applicantId": data["applicant_id"],
        "day": data["day"],
        "time": data["time"],
        "type": data["type"],
    }


def attendance_row(row):
    data = dict(row)
    record = {"studentId": data["student_id"], "date": data["date"], "present": bool(data["present"])}
    if data.get("note"):
        record["note"] = data["note"]
    return record


def tuition_row(row):
    data = dict(row)
    record = {"studentId": data["student_id"], "month": data["month"], "status": data["status"], "amount": data["amount"]}
    if data.get("note"):
        record["note"] = data["note"]
    return record


def assessment_row(row):
    data = dict(row)
    return {
        "studentId": data["student_id"],
        "quarter": data["quarter"],
        "islamicStudies": data["islamic_studies"],
        "quranReading": data["quran_reading"],
        "tajweed": data["tajweed"],
        "memorization": data["memorization"],
        "practical": data["practical"],
        "note": data["note"],
    }


def recalculate_attendance_summary(conn, student_id: str) -> None:
    rows = conn.execute("SELECT present FROM attendance_records WHERE student_id = ? ORDER BY date", (student_id,)).fetchall()
    if not rows:
        attendance_pct = 0
        attendance = "absent"
    else:
        present_count = sum(1 for row in rows if row["present"])
        attendance_pct = round((present_count / len(rows)) * 100)
        attendance = "present" if rows[-1]["present"] else "absent"
    conn.execute(
        "UPDATE students SET attendance_pct = ?, attendance = ? WHERE id = ?",
        (attendance_pct, attendance, student_id),
    )


def enroll_accepted_application(conn, application) -> None:
    existing = conn.execute(
        "SELECT id FROM students WHERE name = ? AND parent_phone = ?",
        (application["name"], application["phone"]),
    ).fetchone()
    if existing:
        return
    next_rank = conn.execute("SELECT COALESCE(MAX(rank), 0) + 1 AS rank FROM students").fetchone()["rank"]
    student_id = f"s-{uuid4().hex[:10]}"
    parent_name = f"{application['parent_name']} {application['parent_surname']}".strip()
    conn.execute(
        """
        INSERT INTO students
        (id, name, age, parent_name, parent_phone, address, klass, teacher, stars, hw, attendance,
         next_hw, attendance_pct, performance, homework_avg, overall, status, rank, tuition_status, amount_due,
         joined_date, enrollment_status, finance_note, termination_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'not_done', 'present', '', 100, 0, 0, 0, 'Good', ?, 'unpaid', 450, ?, 'active', '', '')
        """,
        (
            student_id,
            application["name"],
            application["age"],
            parent_name,
            application["phone"],
            application["address"],
            application["klass"],
            application["teacher"],
            next_rank,
            date.today().isoformat(),
        ),
    )
    for day in ["2026-04-15", "2026-05-01", "2026-05-15", "2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-08-01"]:
        conn.execute(
            "INSERT OR IGNORE INTO attendance_records (student_id, date, present) VALUES (?, ?, 1)",
            (student_id, day),
        )
    for month in ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June"]:
        conn.execute(
            "INSERT OR IGNORE INTO tuition_records (student_id, month, status, amount) VALUES (?, ?, 'unpaid', 0)",
            (student_id, month),
        )


@app.get("/health")
def health():
    with connect() as conn:
        conn.execute("SELECT 1").fetchone()
    return {"status": "ok", "database": "connected", "revision": os.getenv("RENDER_GIT_COMMIT", "local")}


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = decode_token(authorization.removeprefix("Bearer ").strip())
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    with connect() as conn:
        row = conn.execute(
            """
            SELECT auth_accounts.staff_user_id, staff_users.name, auth_accounts.email,
                   auth_accounts.role, auth_accounts.status, auth_accounts.must_change_password, auth_accounts.token_version
            FROM auth_accounts
            JOIN staff_users ON staff_users.id = auth_accounts.staff_user_id
            WHERE auth_accounts.staff_user_id = ? AND auth_accounts.email = ?
            """,
            (payload.get("sub"), payload.get("email")),
        ).fetchone()
    if not row or row["status"] != "active" or row["email"].lower() not in STAFF_ACCOUNTS:
        raise HTTPException(status_code=401, detail="Account is inactive")
    if payload.get("version", 0) != row["token_version"]:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return auth_user_row(row)


def get_ready_user(user=Depends(get_current_user)):
    if user["mustChangePassword"]:
        raise HTTPException(status_code=403, detail="Change your temporary password first")
    return user


def require_roles(*roles: str):
    def dependency(user=Depends(get_ready_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dependency


def teacher_alias(user: dict) -> str:
    return STAFF_ACCOUNTS[user["email"].lower()][0]


@app.post("/api/auth/login")
def login(payload: LoginRequest):
    if str(payload.email).lower() not in STAFF_ACCOUNTS:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    with connect() as conn:
        row = conn.execute(
            """
            SELECT auth_accounts.*, staff_users.name
            FROM auth_accounts
            JOIN staff_users ON staff_users.id = auth_accounts.staff_user_id
            WHERE lower(auth_accounts.email) = lower(?)
            """,
            (payload.email,),
        ).fetchone()
        if not row or not verify_password(payload.password, row["password_hash"], row["password_salt"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if row["status"] != "active":
            raise HTTPException(status_code=403, detail="Account is inactive")
        user = auth_user_row(row)
        token = create_token({"sub": user["id"], "email": user["email"], "role": user["role"], "name": user["name"], "version": row["token_version"]})
        conn.execute("UPDATE staff_users SET last_active = ? WHERE id = ?", ("Just now", user["id"]))
    audit("auth.login", {"userId": user["id"], "role": user["role"]})
    return {"token": token, "user": user}


@app.post("/api/auth/change-password")
def change_password(payload: PasswordChangeRequest, user=Depends(get_current_user)):
    with connect() as conn:
        row = conn.execute("SELECT * FROM auth_accounts WHERE staff_user_id = ?", (user["id"],)).fetchone()
        if not verify_password(payload.currentPassword, row["password_hash"], row["password_salt"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if payload.newPassword == payload.currentPassword:
            raise HTTPException(status_code=400, detail="Choose a different password")
        password_hash, salt = hash_password(payload.newPassword)
        updated = conn.execute(
            "UPDATE auth_accounts SET password_hash = ?, password_salt = ?, must_change_password = 0, token_version = token_version + 1 WHERE staff_user_id = ? AND token_version = ?",
            (password_hash, salt, user["id"], row["token_version"]),
        )
        if updated.rowcount != 1:
            raise HTTPException(status_code=409, detail="Password changed in another session. Sign in again.")
    audit("auth.password_changed", {"userId": user["id"]})
    user = {**user, "mustChangePassword": False}
    return {"user": user, "token": create_token({"sub": user["id"], "email": user["email"], "version": row["token_version"] + 1})}


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return user


@app.post("/api/auth/logout")
def logout(user=Depends(get_current_user)):
    audit("auth.logout", {"userId": user["id"]})
    return {"ok": True}


@app.get("/api/bootstrap")
def bootstrap(user=Depends(get_ready_user)):
    with connect() as conn:
        if user["role"] == "Teacher":
            alias = teacher_alias(user)
            students = [student_row(row) for row in conn.execute("SELECT * FROM students WHERE teacher = ? ORDER BY rank", (alias,)).fetchall()]
            applications = [
                application_row(row)
                for row in conn.execute(
                    "SELECT * FROM applications WHERE teacher = ? AND status = 'teacher_review' ORDER BY submitted DESC, id DESC",
                    (alias,),
                ).fetchall()
            ]
            groups = [group_row(row) for row in conn.execute("SELECT * FROM class_groups WHERE teacher = ? ORDER BY name", (alias,)).fetchall()]
        else:
            students = [student_row(row) for row in conn.execute("SELECT * FROM students ORDER BY rank").fetchall()]
            applications = [
                application_row(row)
                for row in conn.execute("SELECT * FROM applications ORDER BY submitted DESC, id DESC").fetchall()
            ]
            groups = [group_row(row) for row in conn.execute("SELECT * FROM class_groups ORDER BY name").fetchall()]
        applications = [
            app
            for app in applications
        ]
        users = [staff_row(row) for row in conn.execute("SELECT * FROM staff_users ORDER BY name").fetchall() if row["email"].lower() in STAFF_ACCOUNTS]
        meetings = [meeting_row(row) for row in conn.execute("SELECT * FROM meetings ORDER BY day, time").fetchall()]
        if user["role"] == "Teacher":
            users = [staff for staff in users if staff["id"] == user["id"]]
            application_ids = {application["id"] for application in applications}
            meetings = [meeting for meeting in meetings if meeting["applicantId"] in application_ids]
        student_ids = {student["id"] for student in students}
        attendance_records = [
            attendance_row(row)
            for row in conn.execute("SELECT * FROM attendance_records ORDER BY date, student_id").fetchall()
            if row["student_id"] in student_ids
        ]
        tuition_records = [
            tuition_row(row)
            for row in conn.execute("SELECT * FROM tuition_records ORDER BY student_id, month").fetchall()
            if row["student_id"] in student_ids
        ]
        assessment_records = [
            assessment_row(row)
            for row in conn.execute("SELECT * FROM assessment_records ORDER BY quarter, student_id").fetchall()
            if row["student_id"] in student_ids
        ]
    return {
        "students": students,
        "applications": applications,
        "classGroups": groups,
        "staffUsers": users,
        "meetings": meetings,
        "attendanceDates": ["2026-04-15", "2026-05-01", "2026-05-15", "2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-08-01"],
        "attendanceRecords": attendance_records,
        "tuitionMonths": ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June"],
        "tuitionRecords": tuition_records,
        "assessmentRecords": assessment_records,
    }


@app.patch("/api/students/{student_id}")
def update_student(student_id: str, patch: StudentPatch, user=Depends(require_roles("IT Admin", "Finance", "Teacher"))):
    allowed = {
        "attendance": "attendance",
        "stars": "stars",
        "hw": "hw",
        "nextHw": "next_hw",
        "tuitionStatus": "tuition_status",
        "amountDue": "amount_due",
        "enrollmentStatus": "enrollment_status",
        "financeNote": "finance_note",
        "terminationNote": "termination_note",
    }
    updates = patch.model_dump(exclude_unset=True)
    if user["role"] == "Teacher" and set(updates) - {"attendance", "stars", "hw", "nextHw"}:
        raise HTTPException(status_code=403, detail="Teachers can only update learning records")
    if not updates:
        raise HTTPException(status_code=400, detail="No updates supplied")
    with connect() as conn:
        exists = conn.execute("SELECT id, teacher FROM students WHERE id = ?", (student_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Student not found")
        if user["role"] == "Teacher" and exists["teacher"] != teacher_alias(user):
            raise HTTPException(status_code=403, detail="Teachers can update only their own students")
        assignments = ", ".join(f"{allowed[key]} = ?" for key in updates)
        values = [updates[key] for key in updates]
        conn.execute(f"UPDATE students SET {assignments} WHERE id = ?", (*values, student_id))
        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
    audit("student.updated", {"studentId": student_id, "updates": updates, "actorId": user["id"]})
    return student_row(row)


@app.put("/api/attendance")
def update_attendance_record(payload: AttendanceRecordPatch, user=Depends(require_roles("IT Admin", "Teacher"))):
    with connect() as conn:
        exists = conn.execute("SELECT id, teacher FROM students WHERE id = ?", (payload.studentId,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Student not found")
        if user["role"] == "Teacher" and exists["teacher"] != teacher_alias(user):
            raise HTTPException(status_code=403, detail="Teachers can update only their own students")
        conn.execute(
            """
            INSERT INTO attendance_records (student_id, date, present)
            VALUES (?, ?, ?)
            ON CONFLICT(student_id, date) DO UPDATE SET present = excluded.present
            """,
            (payload.studentId, payload.date, 1 if payload.present else 0),
        )
        recalculate_attendance_summary(conn, payload.studentId)
    audit("attendance.updated", {"actorId": user["id"], "studentId": payload.studentId, "date": payload.date, "present": payload.present})
    return {"ok": True}


@app.put("/api/tuition-records")
def update_tuition_record(payload: TuitionRecordPatch, user=Depends(require_roles("IT Admin", "Finance"))):
    with connect() as conn:
        exists = conn.execute("SELECT id FROM students WHERE id = ?", (payload.studentId,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Student not found")
        conn.execute(
            """
            INSERT INTO tuition_records (student_id, month, status, amount)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id, month) DO UPDATE SET status = excluded.status, amount = excluded.amount
            """,
            (payload.studentId, payload.month, payload.status, payload.amount),
        )
    audit("tuition_record.updated", {"actorId": user["id"], "studentId": payload.studentId, "month": payload.month, "status": payload.status, "amount": payload.amount})
    return {"ok": True}


@app.put("/api/assessments")
def update_assessment_record(payload: AssessmentRecordPatch, user=Depends(require_roles("IT Admin", "Teacher"))):
    with connect() as conn:
        exists = conn.execute("SELECT id, teacher FROM students WHERE id = ?", (payload.studentId,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Student not found")
        if user["role"] == "Teacher" and exists["teacher"] != teacher_alias(user):
            raise HTTPException(status_code=403, detail="Teachers can update only their own students")
        conn.execute(
            """
            INSERT INTO assessment_records
            (student_id, quarter, islamic_studies, quran_reading, tajweed, memorization, practical, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, quarter) DO UPDATE SET
              islamic_studies = excluded.islamic_studies,
              quran_reading = excluded.quran_reading,
              tajweed = excluded.tajweed,
              memorization = excluded.memorization,
              practical = excluded.practical,
              note = excluded.note
            """,
            (
                payload.studentId,
                payload.quarter,
                payload.islamicStudies,
                payload.quranReading,
                payload.tajweed,
                payload.memorization,
                payload.practical,
                payload.note,
            ),
        )
    audit("assessment.updated", {"actorId": user["id"], "studentId": payload.studentId, "quarter": payload.quarter})
    return {"ok": True}


@app.post("/api/applications", status_code=201)
def create_application(payload: ApplicationCreate, user=Depends(require_roles("IT Admin", "Registration"))):
    app_id = f"a-{uuid4().hex[:10]}"
    submitted = date.today().isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO applications
            (id, name, age, parent_name, parent_surname, email, phone, address, program, teacher, klass, submitted, status,
             emergency_contact1_name, emergency_contact1_phone, emergency_contact1_relation,
             emergency_contact2_name, emergency_contact2_phone, emergency_contact2_relation, parent_telegram)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app_id,
                payload.name,
                payload.age,
                payload.parentName,
                payload.parentSurname,
                str(payload.email),
                payload.phone,
                payload.address,
                payload.program,
                payload.teacher,
                payload.klass,
                submitted,
                "pending",
                payload.emergencyContact1Name,
                payload.emergencyContact1Phone,
                payload.emergencyContact1Relation,
                payload.emergencyContact2Name,
                payload.emergencyContact2Phone,
                payload.emergencyContact2Relation,
                payload.parentTelegram,
            ),
        )
        row = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    audit("application.created", {"applicationId": app_id, "actorId": user["id"]})
    return application_row(row)


@app.patch("/api/applications/{application_id}/status")
def update_application_status(application_id: str, payload: StatusPatch, user=Depends(require_roles("IT Admin", "Registration", "Teacher"))):
    with connect() as conn:
        exists = conn.execute("SELECT id, teacher, status FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Application not found")
        if user["role"] == "Teacher":
            if exists["teacher"] != teacher_alias(user) or exists["status"] != "teacher_review" or payload.status not in {"accepted", "rejected"}:
                raise HTTPException(status_code=403, detail="Teachers can only accept or reject their assigned review applicants")
        conn.execute("UPDATE applications SET status = ? WHERE id = ?", (payload.status, application_id))
        row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if payload.status == "accepted":
            enroll_accepted_application(conn, row)
    audit("application.status_updated", {"applicationId": application_id, "status": payload.status, "actorId": user["id"]})
    return application_row(row)


@app.post("/api/users", status_code=201)
def create_user(payload: StaffUserCreate, user=Depends(require_roles("IT Admin", "Registration"))):
    raise HTTPException(status_code=403, detail="Access is limited to the eight configured academy accounts")


@app.patch("/api/users/{user_id}/status")
def update_user_status(user_id: str, payload: StatusPatch, user=Depends(require_roles("IT Admin"))):
    if payload.status not in {"active", "inactive"}:
        raise HTTPException(status_code=422, detail="Invalid account status")
    if user_id == user["id"] and payload.status != "active":
        raise HTTPException(status_code=400, detail="You cannot deactivate your own administrator account")
    with connect() as conn:
        exists = conn.execute("SELECT id, email FROM staff_users WHERE id = ?", (user_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="User not found")
        if exists["email"].lower() not in STAFF_ACCOUNTS:
            raise HTTPException(status_code=403, detail="This account is not authorized for academy access")
        conn.execute(
            "UPDATE staff_users SET status = ?, last_active = ? WHERE id = ?",
            (payload.status, "Updated just now", user_id),
        )
        conn.execute("UPDATE auth_accounts SET status = ?, token_version = token_version + 1 WHERE staff_user_id = ?", (payload.status, user_id))
        row = conn.execute("SELECT * FROM staff_users WHERE id = ?", (user_id,)).fetchone()
    audit("user.status_updated", {"userId": user_id, "status": payload.status, "actorId": user["id"]})
    return staff_row(row)


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: str, user=Depends(require_roles("IT Admin", "Registration"))):
    raise HTTPException(status_code=403, detail="The configured academy accounts cannot be deleted")


@app.post("/api/meetings", status_code=201)
def create_meeting(payload: MeetingCreate, user=Depends(require_roles("IT Admin", "Registration"))):
    meeting_id = f"m-{uuid4().hex[:10]}"
    with connect() as conn:
        app_row = conn.execute("SELECT id FROM applications WHERE id = ?", (payload.applicantId,)).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        conn.execute("DELETE FROM meetings WHERE applicant_id = ?", (payload.applicantId,))
        conn.execute(
            "INSERT INTO meetings VALUES (?, ?, ?, ?, ?)",
            (meeting_id, payload.applicantId, payload.day, payload.time, payload.type),
        )
        row = conn.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,)).fetchone()
    audit("meeting.created", {"meetingId": meeting_id, "applicantId": payload.applicantId, "actorId": user["id"]})
    return meeting_row(row)


@app.delete("/api/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, user=Depends(require_roles("IT Admin", "Registration"))):
    with connect() as conn:
        exists = conn.execute("SELECT id FROM meetings WHERE id = ?", (meeting_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Meeting not found")
        conn.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
    audit("meeting.deleted", {"meetingId": meeting_id, "actorId": user["id"]})
    return None


@app.post("/api/actions/reminder")
def queue_reminder(payload: dict, user=Depends(require_roles("IT Admin", "Finance", "Teacher"))):
    audit("reminder.queued", {**payload, "actorId": user["id"]})
    return {"queued": True}


@app.post("/api/actions/export")
def prepare_export(payload: dict, user=Depends(require_roles("IT Admin", "Finance"))):
    audit("export.prepared", {**payload, "actorId": user["id"]})
    return {"ready": True}


def csv_response(filename: str, rows: list[dict[str, object]]) -> StreamingResponse:
    output = io.StringIO()
    fieldnames = list(rows[0].keys()) if rows else ["message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows or [{"message": "No records found"}])
    stream = io.BytesIO(output.getvalue().encode("utf-8-sig"))
    return StreamingResponse(
        stream,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/finance/export")
def finance_export(user=Depends(require_roles("IT Admin", "Finance"))):
    months = ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June"]
    with connect() as conn:
        students = conn.execute(
            """
            SELECT id, name, parent_name, parent_phone, address, klass, teacher
            FROM students
            ORDER BY teacher, klass, name
            """
        ).fetchall()
        records = conn.execute("SELECT * FROM tuition_records").fetchall()
    record_map = {(row["student_id"], row["month"]): row for row in records}
    report_rows = [
        {
            "teacher": student["teacher"],
            "group": student["klass"],
            "student": student["name"],
            "parent": student["parent_name"],
            "phone": student["parent_phone"],
            "address": student["address"],
            **{
                month: (
                    f"{record_map[(student['id'], month)]['status']} {record_map[(student['id'], month)]['amount']}".strip()
                    if (student["id"], month) in record_map
                    else "unpaid 0"
                )
                for month in months
            },
            "report_date": date.today().isoformat(),
        }
        for student in students
    ]
    audit("finance.export_downloaded", {"actorId": user["id"], "rows": len(report_rows)})
    return csv_response(f"aba-tuition-report-{date.today().isoformat()}.csv", report_rows)


@app.get("/api/finance/receipts")
def finance_receipts(user=Depends(require_roles("IT Admin", "Finance"))):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT name, parent_name, parent_phone, klass, teacher
            FROM students
            WHERE tuition_status = 'paid'
            ORDER BY name
            """
        ).fetchall()
    receipt_rows = [
        {
            "student": row["name"],
            "parent": row["parent_name"],
            "phone": row["parent_phone"],
            "group": row["klass"],
            "teacher": row["teacher"],
            "amount_paid_usd": 450,
            "receipt_date": date.today().isoformat(),
        }
        for row in rows
    ]
    audit("finance.receipts_downloaded", {"actorId": user["id"], "rows": len(receipt_rows)})
    return csv_response(f"aba-paid-receipts-{date.today().isoformat()}.csv", receipt_rows)


@app.post("/api/finance/reconcile")
def finance_reconcile(user=Depends(require_roles("IT Admin", "Finance"))):
    with connect() as conn:
        total_due = conn.execute("SELECT COUNT(*) * 450 AS total FROM tuition_records WHERE status IN ('unpaid', 'absent')").fetchone()["total"]
        overdue = conn.execute("SELECT COUNT(*) AS count FROM tuition_records WHERE status IN ('unpaid', 'absent')").fetchone()["count"]
        unpaid = conn.execute("SELECT COUNT(*) AS count FROM tuition_records WHERE status = 'partial'").fetchone()["count"]
        paid = conn.execute("SELECT COUNT(*) AS count FROM tuition_records WHERE status = 'paid'").fetchone()["count"]
    result = {"totalDue": total_due, "overdue": overdue, "unpaid": unpaid, "paid": paid}
    audit("finance.reconciled", {"actorId": user["id"], **result})
    return result


@app.get("/api/audit")
def audit_log(user=Depends(require_roles("IT Admin"))):
    with connect() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50").fetchall())
    return {"events": rows}
