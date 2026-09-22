from __future__ import annotations

from datetime import date
import csv
import io
import os
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import finance
from .database import audit, connect, init_db, rows_to_dicts
from .schemas import (
    ApplicationCreate, StaffEdit, StaffPasswordReset, GroupWrite, PlacementWrite,
    AssessmentRecordPatch,
    AttendanceRecordPatch,
    LoginRequest,
    PasswordChangeRequest,
    MeetingCreate,
    StaffUserCreate,
    StatusPatch,
    StudentPatch,
    TuitionRecordPatch, PaymentCreate, InvoiceCreate, BillingPlanUpdate, PaymentVoid,
)
from .provision_teachers import STAFF_ACCOUNTS, enforce_staff_access, provision_from_env, provision_teacher_groups
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
    provision_teacher_groups()


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
        "teacherAlias": STAFF_ACCOUNTS.get(data["email"].lower(), ("", ""))[0] if data["role"] == "Teacher" else "",
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
        "teacherAlias": STAFF_ACCOUNTS[data["email"].lower()][0] if data["role"] == "Teacher" else "",
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
    validate_placement(conn, application["klass"], application["teacher"], require_seat=True)
    next_rank = conn.execute("SELECT COALESCE(MAX(rank), 0) + 1 AS rank FROM students").fetchone()["rank"]
    student_id = f"s-{uuid4().hex[:10]}"
    parent_name = f"{application['parent_name']} {application['parent_surname']}".strip()
    conn.execute(
        """
        INSERT INTO students
        (id, name, age, parent_name, parent_phone, address, klass, teacher, stars, hw, attendance,
         next_hw, attendance_pct, performance, homework_avg, overall, status, rank, tuition_status, amount_due,
         joined_date, enrollment_status, finance_note, termination_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'not_done', 'absent', '', 0, 0, 0, 0, 'Good', ?, 'paid', 0, ?, 'active', '', '')
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
        if not conn.postgres:
            conn.execute("BEGIN IMMEDIATE")
        query = "SELECT s.* FROM students s JOIN billing_plans b ON b.student_id=s.id WHERE b.active=1 AND s.enrollment_status='active'"
        params = ()
        if user["role"] == "Teacher":
            query += " AND s.teacher=?"
            params = (teacher_alias(user),)
        query += " ORDER BY s.id" + (" FOR UPDATE OF s" if conn.postgres else "")
        for student in conn.execute(query, params).fetchall():
            finance.sync_plan(conn, student)
    with connect() as conn:
        if conn.postgres:
            conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        else:
            conn.execute("BEGIN")
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
        ledger, balances = finance.snapshot(conn, student_ids)
        students = [{**student, **balances[student["id"]]} for student in students]
        # Historical cells remain visible but are never counted as ledger receipts.
        legacy_tuition = [{**record, "legacy": True} for record in tuition_records]
        tuition_records = legacy_tuition + [dict(studentId=i["studentId"], month=i["period"], status=i["status"],
                                                 amount=i["paid"], balance=i["balance"], dueDate=i["dueDate"]) for i in ledger["invoices"]]
        for group in groups:
            group["enrolled"] = sum(1 for student in students if student["klass"] == group["name"] and student["enrollmentStatus"] == "active")
    return {
        "students": students,
        "applications": applications,
        "classGroups": groups,
        "staffUsers": users,
        "meetings": meetings,
        "attendanceDates": sorted({record["date"] for record in attendance_records} | {date.today().isoformat()}),
        "attendanceRecords": attendance_records,
        "tuitionMonths": sorted({record["month"] for record in tuition_records}),
        **ledger,
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
    if set(updates) & {"tuitionStatus", "amountDue"}:
        raise HTTPException(409, "Balances are calculated automatically. Record a payment or create an invoice in Tuition & Payments.")
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
        _, balances = finance.snapshot(conn, [student_id])
        result = {**student_row(row), **balances[student_id]}
    audit("student.updated", {"studentId": student_id, "updates": updates, "actorId": user["id"]})
    return result


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
    raise HTTPException(409, "Monthly totals are calculated automatically. Use Tuition & Payments to record payments.")


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
        if not conn.postgres:
            conn.execute("BEGIN IMMEDIATE")
        group = validate_placement(conn, payload.klass, payload.teacher)
        if not payload.name.strip() or not payload.parentName.strip() or not payload.phone.strip():
            raise HTTPException(422, "Student name, parent name and phone are required")
        if conn.execute("SELECT id FROM applications WHERE lower(trim(name))=? AND phone=? AND status!='rejected'", (payload.name.strip().lower(), payload.phone)).fetchone():
            raise HTTPException(409, "This student already has an application. Use the existing application or student record.")
        payload.program = group["program"]
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
                "accepted" if payload.intakeMode == "enroll" else "teacher_review" if payload.intakeMode == "review" else "pending",
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
        if payload.intakeMode == "enroll":
            enroll_accepted_application(conn, row)
    audit("application.created", {"applicationId": app_id, "actorId": user["id"]})
    return application_row(row)


@app.patch("/api/applications/{application_id}/status")
def update_application_status(application_id: str, payload: StatusPatch, user=Depends(require_roles("IT Admin", "Registration", "Teacher"))):
    with connect() as conn:
        if not conn.postgres:
            conn.execute("BEGIN IMMEDIATE")
        exists = conn.execute("SELECT id, teacher, status FROM applications WHERE id = ?" + (" FOR UPDATE" if conn.postgres else ""), (application_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Application not found")
        if user["role"] == "Teacher":
            if exists["teacher"] != teacher_alias(user) or exists["status"] != "teacher_review" or payload.status not in {"accepted", "rejected"}:
                raise HTTPException(status_code=403, detail="Teachers can only accept or reject their assigned review applicants")
        if payload.status not in {"pending", "assessment", "interview", "teacher_review", "waitlist", "accepted", "rejected"}:
            raise HTTPException(422, "Invalid application status")
        if exists["status"] == "accepted" and payload.status != "accepted":
            raise HTTPException(409, "Student is already enrolled. Manage their enrollment from the student record.")
        if payload.status == "teacher_review":
            current = conn.execute("SELECT * FROM applications WHERE id=?", (application_id,)).fetchone()
            validate_placement(conn, current["klass"], current["teacher"])
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
    def safe_cell(value):
        if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
            return "'" + value
        return value
    writer.writerows([{key: safe_cell(value) for key, value in row.items()} for row in rows] or [{"message": "No records found"}])
    stream = io.BytesIO(output.getvalue().encode("utf-8-sig"))
    return StreamingResponse(
        stream,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/finance/export")
def finance_export(user=Depends(require_roles("IT Admin", "Finance"))):
    data = bootstrap(user)
    people = {s["id"]: s for s in data["students"]}
    rows = [dict(student=people[i["studentId"]]["name"], parent=people[i["studentId"]]["parentName"],
                 phone=people[i["studentId"]]["parentPhone"], period=i["period"], due_date=i["dueDate"],
                 billed_usd=i["amount"], received_usd=i["paid"], balance_usd=i["balance"], status=i["status"])
            for i in data["invoices"]]
    return csv_response(f"aba-tuition-report-{date.today().isoformat()}.csv", rows)


@app.get("/api/finance/receipts")
def finance_receipts(user=Depends(require_roles("IT Admin", "Finance"))):
    data = bootstrap(user)
    rows = [dict(receipt=p["id"], student=p["studentName"], parent=p["parentName"], phone=p["parentPhone"],
                 period=p["period"], amount_usd=p["amount"], method=p["method"], paid_on=p["paidOn"],
                 reference=p["reference"], status="void" if p["voidedAt"] else "received", void_reason=p["voidReason"] or "")
            for p in data["payments"]]
    return csv_response(f"aba-receipts-{date.today().isoformat()}.csv", rows)


@app.post("/api/finance/reconcile")
def finance_reconcile(user=Depends(require_roles("IT Admin", "Finance"))):
    students = bootstrap(user)["students"]
    return dict(totalDue=round(sum(s["amountDue"] for s in students), 2),
                overdue=sum(s["tuitionStatus"] == "overdue" for s in students),
                unpaid=sum(s["tuitionStatus"] == "unpaid" for s in students),
                paid=sum(s["tuitionStatus"] == "paid" for s in students))


@app.post("/api/finance/invoices", status_code=201)
def create_invoice(payload: InvoiceCreate, user=Depends(require_roles("IT Admin", "Finance"))):
    with connect() as conn:
        finance.transaction_lock(conn, payload.studentId)
        previous = finance.replay(conn, payload)
        if previous:
            return previous
        existing = conn.execute("SELECT id FROM invoices WHERE student_id = ? AND period = ?", (payload.studentId, payload.period)).fetchone()
        if existing:
            raise HTTPException(409, "An invoice already exists for this student and month. Use the existing invoice.")
        invoice_id = str(uuid4())
        conn.execute("INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?)",
                     (invoice_id, payload.studentId, payload.period, int(payload.amount * 100), payload.dueDate.isoformat(), finance.now()))
        result = {"id": invoice_id}
        finance.audit_in_transaction(conn, "invoice.created", {"actorId": user["id"], "invoiceId": invoice_id})
        finance.remember(conn, payload, result)
    return result


@app.put("/api/finance/billing-plan")
def update_billing_plan(payload: BillingPlanUpdate, user=Depends(require_roles("IT Admin", "Finance"))):
    with connect() as conn:
        student = finance.transaction_lock(conn, payload.studentId)
        conn.execute("""INSERT INTO billing_plans VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(student_id) DO UPDATE SET amount_cents=excluded.amount_cents, start_month=excluded.start_month,
                     end_month=excluded.end_month, due_day=excluded.due_day, active=excluded.active""",
                     (payload.studentId, int(payload.amount * 100), payload.startMonth, payload.endMonth, payload.dueDay, int(payload.active)))
        finance.sync_plan(conn, student)
        finance.audit_in_transaction(conn, "billing_plan.updated", {"actorId": user["id"], **payload.model_dump(mode="json")})
    return {"ok": True}


@app.post("/api/finance/payments", status_code=201)
def record_payment(payload: PaymentCreate, user=Depends(require_roles("IT Admin", "Finance"))):
    with connect() as conn:
        student = finance.transaction_lock(conn, payload.studentId)
        previous = finance.replay(conn, payload)
        if previous:
            return previous
        invoice = conn.execute("SELECT * FROM invoices WHERE id = ? AND student_id = ?", (payload.invoiceId, payload.studentId)).fetchone()
        if not invoice:
            raise HTTPException(404, "Invoice not found for this student")
        paid = conn.execute("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE invoice_id = ? AND voided_at IS NULL", (payload.invoiceId,)).fetchone()["total"]
        cents = int(payload.amount * 100)
        if cents > invoice["amount_cents"] - paid:
            raise HTTPException(409, "Payment exceeds the remaining balance. Refresh and check the amount.")
        payment_id = str(uuid4())
        conn.execute("""INSERT INTO payments(id, invoice_id, amount_cents, method, paid_on, reference, note, actor_id,
                     student_name, parent_name, parent_phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                     (payment_id, payload.invoiceId, cents, payload.method, payload.paidOn.isoformat(), payload.reference,
                      payload.note, user["id"], student["name"], student["parent_name"], student["parent_phone"], finance.now()))
        result = {"id": payment_id}
        finance.audit_in_transaction(conn, "payment.received", {"actorId": user["id"], "paymentId": payment_id, "amountCents": cents})
        finance.remember(conn, payload, result)
    return result


@app.post("/api/finance/payments/{payment_id}/void")
def void_payment(payment_id: str, payload: PaymentVoid, user=Depends(require_roles("IT Admin", "Finance"))):
    with connect() as conn:
        row = conn.execute("SELECT i.student_id FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.id=?", (payment_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Payment not found")
    with connect() as conn:
        finance.transaction_lock(conn, row["student_id"])
        updated = conn.execute("UPDATE payments SET voided_at=?, void_reason=?, void_actor_id=? WHERE id=? AND voided_at IS NULL RETURNING id",
                               (finance.now(), payload.reason.strip(), user["id"], payment_id)).fetchone()
        if updated:
            finance.audit_in_transaction(conn, "payment.voided", {"actorId": user["id"], "paymentId": payment_id, "reason": payload.reason})
    return {"ok": True}


@app.get("/api/audit")
def audit_log(user=Depends(require_roles("IT Admin"))):
    with connect() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50").fetchall())
    return {"events": rows}


def validate_placement(conn, klass, teacher, require_seat=False):
    group = conn.execute("SELECT * FROM class_groups WHERE name=?" + (" FOR UPDATE" if conn.postgres else ""), (klass,)).fetchone()
    if not group or group["teacher"] != teacher:
        raise HTTPException(422, "Select an existing group belonging to this teacher")
    active = [STAFF_ACCOUNTS[r["email"].lower()][0] for r in conn.execute("SELECT email FROM staff_users WHERE role='Teacher' AND status='active'").fetchall() if r["email"].lower() in STAFF_ACCOUNTS]
    if teacher not in active:
        raise HTTPException(422, "This teacher is not active")
    count = conn.execute("SELECT COUNT(*) AS n FROM students WHERE klass=? AND enrollment_status='active'", (klass,)).fetchone()["n"]
    if require_seat and count >= group["capacity"]:
        raise HTTPException(409, "This group is full. Choose another group or increase capacity.")
    return group


@app.patch("/api/users/{user_id}")
def edit_staff(user_id: str, payload: StaffEdit, user=Depends(require_roles("IT Admin"))):
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Enter the staff member's name")
    with connect() as conn:
        target = conn.execute("SELECT * FROM staff_users WHERE id=?", (user_id,)).fetchone()
        if not target or target["email"].lower() not in STAFF_ACCOUNTS:
            raise HTTPException(404, "Approved staff account not found")
        conn.execute("UPDATE staff_users SET name=? WHERE id=?", (name, user_id))
        finance.audit_in_transaction(conn, "user.edited", {"actorId": user["id"], "userId": user_id, "name": name})
        result = staff_row(conn.execute("SELECT * FROM staff_users WHERE id=?", (user_id,)).fetchone())
    return result


@app.post("/api/users/{user_id}/reset-password")
def reset_staff_password(user_id: str, payload: StaffPasswordReset, user=Depends(require_roles("IT Admin"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Use Change password to change your own administrator password")
    digest, salt = hash_password(payload.temporaryPassword)
    with connect() as conn:
        target = conn.execute("SELECT email FROM staff_users WHERE id=?", (user_id,)).fetchone()
        if not target or target["email"].lower() not in STAFF_ACCOUNTS:
            raise HTTPException(404, "Approved staff account not found")
        conn.execute("UPDATE auth_accounts SET password_hash=?, password_salt=?, must_change_password=?, token_version=token_version+1 WHERE staff_user_id=?", (digest, salt, 0 if STAFF_ACCOUNTS[target["email"].lower()][1] == "Teacher" else 1, user_id))
        finance.audit_in_transaction(conn, "user.password_reset", {"actorId": user["id"], "userId": user_id})
    return {"ok": True}


@app.post("/api/groups", status_code=201)
def create_group(payload: GroupWrite, user=Depends(require_roles("IT Admin", "Registration"))):
    return save_group(None, payload, user)


@app.put("/api/groups/{group_id}")
def edit_group(group_id: str, payload: GroupWrite, user=Depends(require_roles("IT Admin", "Registration"))):
    return save_group(group_id, payload, user)


def save_group(group_id, payload, user):
    if len(payload.name.strip()) < 2 or len(payload.program.strip()) < 2:
        raise HTTPException(422, "Group name and program must contain at least two characters")
    with connect() as conn:
        if not conn.postgres:
            conn.execute("BEGIN IMMEDIATE")
        teachers = [STAFF_ACCOUNTS[r["email"].lower()][0] for r in conn.execute("SELECT email FROM staff_users WHERE role='Teacher' AND status='active'").fetchall() if r["email"].lower() in STAFF_ACCOUNTS]
        if payload.teacher not in teachers:
            raise HTTPException(422, "Select an active teacher")
        existing = conn.execute("SELECT * FROM class_groups WHERE id=?" + (" FOR UPDATE" if conn.postgres else ""), (group_id,)).fetchone() if group_id else None
        if group_id and not existing:
            raise HTTPException(404, "Group not found")
        duplicate = conn.execute("SELECT id FROM class_groups WHERE name=?", (payload.name.strip(),)).fetchone()
        if duplicate and duplicate["id"] != group_id:
            raise HTTPException(409, "Group name already exists")
        if existing:
            count = conn.execute("SELECT COUNT(*) AS n FROM students WHERE klass=? AND enrollment_status='active'", (existing["name"],)).fetchone()["n"]
            if payload.capacity < count:
                raise HTTPException(409, "Capacity cannot be below the current student count")
            conn.execute("UPDATE students SET klass=?, teacher=? WHERE klass=?", (payload.name.strip(), payload.teacher, existing["name"]))
            conn.execute("UPDATE applications SET klass=?, teacher=?, program=? WHERE klass=?", (payload.name.strip(), payload.teacher, payload.program, existing["name"]))
            conn.execute("UPDATE class_groups SET name=?,teacher=?,program=?,schedule=?,capacity=? WHERE id=?", (payload.name.strip(), payload.teacher, payload.program, payload.schedule, payload.capacity, group_id))
        else:
            group_id = str(uuid4())
            conn.execute("INSERT INTO class_groups VALUES (?, ?, ?, ?, ?, ?, 0)", (group_id,payload.name.strip(),payload.teacher,payload.program,payload.schedule,payload.capacity))
        finance.audit_in_transaction(conn, "group.saved", {"actorId":user["id"], "groupId":group_id})
    return {"id":group_id}


@app.put("/api/students/{student_id}/placement")
def transfer_student(student_id: str, payload: PlacementWrite, user=Depends(require_roles("IT Admin", "Registration"))):
    with connect() as conn:
        if not conn.postgres:
            conn.execute("BEGIN IMMEDIATE")
        group = conn.execute("SELECT * FROM class_groups WHERE id=?" + (" FOR UPDATE" if conn.postgres else ""), (payload.groupId,)).fetchone()
        if not group:
            raise HTTPException(404, "Group not found")
        student = conn.execute("SELECT * FROM students WHERE id=?" + (" FOR UPDATE" if conn.postgres else ""), (student_id,)).fetchone()
        if not student:
            raise HTTPException(404, "Student not found")
        validate_placement(conn, group["name"], group["teacher"], require_seat=student["klass"] != group["name"] and student["enrollment_status"] == "active")
        conn.execute("UPDATE students SET klass=?,teacher=? WHERE id=?", (group["name"],group["teacher"],student_id))
        conn.execute("UPDATE applications SET klass=?,teacher=?,program=? WHERE name=? AND phone=? AND status='accepted'", (group["name"],group["teacher"],group["program"],student["name"],student["parent_phone"]))
        finance.audit_in_transaction(conn,"student.transferred",{"actorId":user["id"],"studentId":student_id,"groupId":payload.groupId})
    return {"ok":True}
