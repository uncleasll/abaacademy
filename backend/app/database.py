from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "academy.db"))


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS students (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              age INTEGER NOT NULL,
              parent_name TEXT NOT NULL,
              parent_phone TEXT NOT NULL,
              address TEXT NOT NULL,
              klass TEXT NOT NULL,
              teacher TEXT NOT NULL,
              stars INTEGER NOT NULL DEFAULT 0,
              hw TEXT NOT NULL DEFAULT 'not_done',
              attendance TEXT NOT NULL DEFAULT 'present',
              next_hw TEXT NOT NULL DEFAULT '',
              attendance_pct INTEGER NOT NULL DEFAULT 0,
              performance INTEGER NOT NULL DEFAULT 0,
              homework_avg INTEGER NOT NULL DEFAULT 0,
              overall INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'Good',
              rank INTEGER NOT NULL DEFAULT 0,
              tuition_status TEXT NOT NULL DEFAULT 'unpaid',
              amount_due INTEGER NOT NULL DEFAULT 0,
              joined_date TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS applications (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              age INTEGER NOT NULL,
              parent_name TEXT NOT NULL,
              parent_surname TEXT NOT NULL,
              phone TEXT NOT NULL,
              address TEXT NOT NULL,
              program TEXT NOT NULL,
              teacher TEXT NOT NULL,
              klass TEXT NOT NULL,
              submitted TEXT NOT NULL,
              status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS class_groups (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              teacher TEXT NOT NULL,
              program TEXT NOT NULL,
              schedule TEXT NOT NULL,
              capacity INTEGER NOT NULL,
              enrolled INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS staff_users (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              role TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL,
              last_active TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS auth_accounts (
              id TEXT PRIMARY KEY,
              staff_user_id TEXT NOT NULL UNIQUE,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              password_salt TEXT NOT NULL,
              role TEXT NOT NULL,
              status TEXT NOT NULL,
              FOREIGN KEY(staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS meetings (
              id TEXT PRIMARY KEY,
              applicant_id TEXT NOT NULL,
              day TEXT NOT NULL,
              time TEXT NOT NULL,
              type TEXT NOT NULL,
              FOREIGN KEY(applicant_id) REFERENCES applications(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS attendance_records (
              student_id TEXT NOT NULL,
              date TEXT NOT NULL,
              present INTEGER NOT NULL,
              PRIMARY KEY(student_id, date),
              FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tuition_records (
              student_id TEXT NOT NULL,
              month TEXT NOT NULL,
              status TEXT NOT NULL,
              amount INTEGER NOT NULL DEFAULT 0,
              note TEXT NOT NULL DEFAULT '',
              PRIMARY KEY(student_id, month),
              FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event TEXT NOT NULL,
              payload TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        for statement in [
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
        ]:
            try:
                conn.execute(statement)
            except sqlite3.OperationalError as exc:
                if "duplicate column name" not in str(exc):
                    raise
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS assessment_records (
              student_id TEXT NOT NULL,
              quarter TEXT NOT NULL,
              islamic_studies INTEGER NOT NULL DEFAULT 0,
              quran_reading INTEGER NOT NULL DEFAULT 0,
              tajweed INTEGER NOT NULL DEFAULT 0,
              memorization INTEGER NOT NULL DEFAULT 0,
              practical INTEGER NOT NULL DEFAULT 0,
              note TEXT NOT NULL DEFAULT '',
              PRIMARY KEY(student_id, quarter),
              FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
            );
            """
        )


def audit(event: str, payload: dict[str, Any] | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO audit_log (event, payload) VALUES (?, ?)",
            (event, json.dumps(payload or {})),
        )
