from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "academy.db"))
USING_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))


class DatabaseConnection:
    """Compatibility layer: PostgreSQL in production, SQLite for local development."""

    def __init__(self, raw: Any, postgres: bool) -> None:
        self.raw = raw
        self.postgres = postgres

    def _sql(self, sql: str) -> str:
        if "INSERT OR IGNORE INTO" in sql:
            sql = sql.replace("INSERT OR IGNORE INTO", "INSERT INTO") + " ON CONFLICT DO NOTHING"
        return sql.replace("?", "%s") if self.postgres else sql

    def execute(self, sql: str, params: tuple[Any, ...] | list[Any] = ()):
        return self.raw.execute(self._sql(sql), params)

    def executemany(self, sql: str, params: list[tuple[Any, ...]]):
        if self.postgres:
            with self.raw.cursor() as cursor:
                return cursor.executemany(self._sql(sql), params)
        return self.raw.executemany(sql, params)


@contextmanager
def connect() -> Iterator[DatabaseConnection]:
    if USING_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        raw = psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10, prepare_threshold=None)
        conn = DatabaseConnection(raw, postgres=True)
    else:
        DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
        raw = sqlite3.connect(DATABASE_PATH)
        raw.row_factory = sqlite3.Row
        raw.execute("PRAGMA foreign_keys = ON")
        conn = DatabaseConnection(raw, postgres=False)
    try:
        yield conn
        raw.commit()
    except Exception:
        raw.rollback()
        raise
    finally:
        raw.close()


def rows_to_dicts(rows: list[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL,
  parent_name TEXT NOT NULL, parent_phone TEXT NOT NULL, address TEXT NOT NULL,
  klass TEXT NOT NULL, teacher TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0,
  hw TEXT NOT NULL DEFAULT 'not_done', attendance TEXT NOT NULL DEFAULT 'present',
  next_hw TEXT NOT NULL DEFAULT '', attendance_pct INTEGER NOT NULL DEFAULT 0,
  performance INTEGER NOT NULL DEFAULT 0, homework_avg INTEGER NOT NULL DEFAULT 0,
  overall INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Good',
  rank INTEGER NOT NULL DEFAULT 0, tuition_status TEXT NOT NULL DEFAULT 'unpaid',
  amount_due INTEGER NOT NULL DEFAULT 0, joined_date TEXT NOT NULL DEFAULT '',
  enrollment_status TEXT NOT NULL DEFAULT 'active', finance_note TEXT NOT NULL DEFAULT '',
  termination_note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL,
  parent_name TEXT NOT NULL, parent_surname TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL, address TEXT NOT NULL, program TEXT NOT NULL, teacher TEXT NOT NULL,
  klass TEXT NOT NULL, submitted TEXT NOT NULL, status TEXT NOT NULL,
  emergency_contact1_name TEXT NOT NULL DEFAULT '', emergency_contact1_phone TEXT NOT NULL DEFAULT '',
  emergency_contact1_relation TEXT NOT NULL DEFAULT '', emergency_contact2_name TEXT NOT NULL DEFAULT '',
  emergency_contact2_phone TEXT NOT NULL DEFAULT '', emergency_contact2_relation TEXT NOT NULL DEFAULT '',
  parent_telegram TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS class_groups (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, teacher TEXT NOT NULL,
  program TEXT NOT NULL, schedule TEXT NOT NULL, capacity INTEGER NOT NULL, enrolled INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, last_active TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY, staff_user_id TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL,
  FOREIGN KEY(staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY, applicant_id TEXT NOT NULL, day TEXT NOT NULL, time TEXT NOT NULL, type TEXT NOT NULL,
  FOREIGN KEY(applicant_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS attendance_records (
  student_id TEXT NOT NULL, date TEXT NOT NULL, present INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(student_id, date), FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tuition_records (
  student_id TEXT NOT NULL, month TEXT NOT NULL, status TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '', PRIMARY KEY(student_id, month),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS assessment_records (
  student_id TEXT NOT NULL, quarter TEXT NOT NULL, islamic_studies INTEGER NOT NULL DEFAULT 0,
  quran_reading INTEGER NOT NULL DEFAULT 0, tajweed INTEGER NOT NULL DEFAULT 0,
  memorization INTEGER NOT NULL DEFAULT 0, practical INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(student_id, quarter), FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
"""

SQLITE_AUDIT_SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""

POSTGRES_AUDIT_SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY, event TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""

MIGRATIONS = [
    "ALTER TABLE auth_accounts ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE auth_accounts ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE students ADD COLUMN enrollment_status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE students ADD COLUMN finance_note TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE students ADD COLUMN termination_note TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE students ADD COLUMN joined_date TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN emergency_contact1_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN emergency_contact1_phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN emergency_contact1_relation TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN emergency_contact2_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN emergency_contact2_phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN emergency_contact2_relation TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN parent_telegram TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE applications ADD COLUMN email TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE attendance_records ADD COLUMN note TEXT NOT NULL DEFAULT ''",
]


def init_db() -> None:
    with connect() as conn:
        for statement in (part.strip() for part in SCHEMA.split(";")):
            if statement:
                conn.execute(statement)
        conn.execute(POSTGRES_AUDIT_SCHEMA if conn.postgres else SQLITE_AUDIT_SCHEMA)
        if conn.postgres:
            # Supabase's public API must not expose staff hashes or academy records.
            # The backend connects as the table owner and remains able to access them.
            for table in (
                "students", "applications", "class_groups", "staff_users", "auth_accounts",
                "meetings", "attendance_records", "tuition_records", "assessment_records", "audit_log",
            ):
                conn.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    # Separate transactions prevent an old-schema migration failure from aborting the full startup.
    for migration in MIGRATIONS:
        try:
            with connect() as conn:
                sql = migration.replace("ADD COLUMN ", "ADD COLUMN IF NOT EXISTS ") if conn.postgres else migration
                conn.execute(sql)
        except sqlite3.OperationalError as exc:
            if "duplicate column name" not in str(exc):
                raise


def audit(event: str, payload: dict[str, Any] | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO audit_log (event, payload) VALUES (?, ?)",
            (event, json.dumps(payload or {})),
        )
