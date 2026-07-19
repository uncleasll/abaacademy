from __future__ import annotations

from datetime import date
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import audit, connect, init_db, rows_to_dicts
from .schemas import (
    ApplicationCreate,
    LoginRequest,
    MeetingCreate,
    StaffUserCreate,
    StatusPatch,
    StudentPatch,
)
from .seed import seed_if_empty
from .security import create_token, decode_token, hash_password, verify_password

app = FastAPI(title="ABA Academy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()
    seed_if_empty()


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
    }


def application_row(row):
    data = dict(row)
    return {
        "id": data["id"],
        "name": data["name"],
        "age": data["age"],
        "parentName": data["parent_name"],
        "parentSurname": data["parent_surname"],
        "phone": data["phone"],
        "address": data["address"],
        "program": data["program"],
        "teacher": data["teacher"],
        "klass": data["klass"],
        "submitted": data["submitted"],
        "status": data["status"],
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


@app.get("/health")
def health():
    return {"status": "ok"}


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
                   auth_accounts.role, auth_accounts.status
            FROM auth_accounts
            JOIN staff_users ON staff_users.id = auth_accounts.staff_user_id
            WHERE auth_accounts.staff_user_id = ? AND auth_accounts.email = ?
            """,
            (payload.get("sub"), payload.get("email")),
        ).fetchone()
    if not row or row["status"] != "active":
        raise HTTPException(status_code=401, detail="Account is inactive")
    return auth_user_row(row)


def require_roles(*roles: str):
    def dependency(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dependency


@app.post("/api/auth/login")
def login(payload: LoginRequest):
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
        token = create_token({"sub": user["id"], "email": user["email"], "role": user["role"], "name": user["name"]})
        conn.execute("UPDATE staff_users SET last_active = ? WHERE id = ?", ("Just now", user["id"]))
    audit("auth.login", {"userId": user["id"], "role": user["role"]})
    return {"token": token, "user": user}


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return user


@app.post("/api/auth/logout")
def logout(user=Depends(get_current_user)):
    audit("auth.logout", {"userId": user["id"]})
    return {"ok": True}


@app.get("/api/bootstrap")
def bootstrap(user=Depends(get_current_user)):
    with connect() as conn:
        students = [student_row(row) for row in conn.execute("SELECT * FROM students ORDER BY rank").fetchall()]
        applications = [
            application_row(row)
            for row in conn.execute("SELECT * FROM applications ORDER BY submitted DESC, id DESC").fetchall()
        ]
        groups = [group_row(row) for row in conn.execute("SELECT * FROM class_groups ORDER BY name").fetchall()]
        users = [staff_row(row) for row in conn.execute("SELECT * FROM staff_users ORDER BY name").fetchall()]
        meetings = [meeting_row(row) for row in conn.execute("SELECT * FROM meetings ORDER BY day, time").fetchall()]
    return {
        "students": students,
        "applications": applications,
        "classGroups": groups,
        "staffUsers": users,
        "meetings": meetings,
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
    }
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates supplied")
    with connect() as conn:
        exists = conn.execute("SELECT id FROM students WHERE id = ?", (student_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Student not found")
        assignments = ", ".join(f"{allowed[key]} = ?" for key in updates)
        values = [updates[key] for key in updates]
        conn.execute(f"UPDATE students SET {assignments} WHERE id = ?", (*values, student_id))
        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
    audit("student.updated", {"studentId": student_id, "updates": updates, "actorId": user["id"]})
    return student_row(row)


@app.post("/api/applications", status_code=201)
def create_application(payload: ApplicationCreate, user=Depends(require_roles("IT Admin", "Registration"))):
    app_id = f"a-{uuid4().hex[:10]}"
    submitted = date.today().isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO applications
            (id, name, age, parent_name, parent_surname, phone, address, program, teacher, klass, submitted, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app_id,
                payload.name,
                payload.age,
                payload.parentName,
                payload.parentSurname,
                payload.phone,
                payload.address,
                payload.program,
                payload.teacher,
                payload.klass,
                submitted,
                "pending",
            ),
        )
        row = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    audit("application.created", {"applicationId": app_id, "actorId": user["id"]})
    return application_row(row)


@app.patch("/api/applications/{application_id}/status")
def update_application_status(application_id: str, payload: StatusPatch, user=Depends(require_roles("IT Admin", "Registration"))):
    with connect() as conn:
        exists = conn.execute("SELECT id FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Application not found")
        conn.execute("UPDATE applications SET status = ? WHERE id = ?", (payload.status, application_id))
        row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
    audit("application.status_updated", {"applicationId": application_id, "status": payload.status, "actorId": user["id"]})
    return application_row(row)


@app.post("/api/users", status_code=201)
def create_user(payload: StaffUserCreate, user=Depends(require_roles("IT Admin"))):
    user_id = f"u-{uuid4().hex[:10]}"
    with connect() as conn:
        conn.execute(
            "INSERT INTO staff_users VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, payload.name, payload.role, payload.email, "active", "Just now"),
        )
        password_hash, password_salt = hash_password("TempPass123!")
        conn.execute(
            "INSERT INTO auth_accounts VALUES (?, ?, ?, ?, ?, ?, ?)",
            (f"auth-{user_id}", user_id, payload.email, password_hash, password_salt, payload.role, "active"),
        )
        row = conn.execute("SELECT * FROM staff_users WHERE id = ?", (user_id,)).fetchone()
    audit("user.created", {"userId": user_id, "role": payload.role, "actorId": user["id"]})
    return staff_row(row)


@app.patch("/api/users/{user_id}/status")
def update_user_status(user_id: str, payload: StatusPatch, user=Depends(require_roles("IT Admin"))):
    with connect() as conn:
        exists = conn.execute("SELECT id FROM staff_users WHERE id = ?", (user_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="User not found")
        conn.execute(
            "UPDATE staff_users SET status = ?, last_active = ? WHERE id = ?",
            (payload.status, "Updated just now", user_id),
        )
        conn.execute("UPDATE auth_accounts SET status = ? WHERE staff_user_id = ?", (payload.status, user_id))
        row = conn.execute("SELECT * FROM staff_users WHERE id = ?", (user_id,)).fetchone()
    audit("user.status_updated", {"userId": user_id, "status": payload.status, "actorId": user["id"]})
    return staff_row(row)


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
def queue_reminder(payload: dict, user=Depends(require_roles("IT Admin", "Finance"))):
    audit("reminder.queued", {**payload, "actorId": user["id"]})
    return {"queued": True}


@app.post("/api/actions/export")
def prepare_export(payload: dict, user=Depends(require_roles("IT Admin", "Finance"))):
    audit("export.prepared", {**payload, "actorId": user["id"]})
    return {"ready": True}


@app.get("/api/audit")
def audit_log(user=Depends(require_roles("IT Admin"))):
    with connect() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50").fetchall())
    return {"events": rows}
