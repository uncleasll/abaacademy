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
              amount_due INTEGER NOT NULL DEFAULT 0
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

            CREATE TABLE IF NOT EXISTS audit_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event TEXT NOT NULL,
              payload TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


def audit(event: str, payload: dict[str, Any] | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO audit_log (event, payload) VALUES (?, ?)",
            (event, json.dumps(payload or {})),
        )
