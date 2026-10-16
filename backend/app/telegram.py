from __future__ import annotations

import html
import json
import logging
import os
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from .database import connect

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
API_BASE = os.getenv("TELEGRAM_API_BASE", "https://api.telegram.org").strip().rstrip("/")
ACADEMY_NAME = os.getenv("TELEGRAM_ACADEMY_NAME", "Al-Bukhari Academy").strip() or "Al-Bukhari Academy"
logger = logging.getLogger("aba.telegram")


def _call(method: str, payload: dict) -> dict:
    if not BOT_TOKEN:
        raise HTTPException(503, "Telegram bot is not configured")
    request = Request(
        f"{API_BASE}/bot{BOT_TOKEN}/{method}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=12) as response:
            result = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError) as exc:
        raise HTTPException(502, "Telegram is temporarily unavailable") from exc
    if not result.get("ok"):
        raise HTTPException(502, result.get("description", "Telegram rejected the request"))
    return result["result"]


def init_telegram() -> None:
    with connect() as conn:
        # Class group chats that receive the daily attendance post, and the post already sent for each class day.
        conn.execute("CREATE TABLE IF NOT EXISTS group_telegram (group_id TEXT PRIMARY KEY, chat_id TEXT NOT NULL)")
        conn.execute("""CREATE TABLE IF NOT EXISTS telegram_class_posts (
          group_id TEXT NOT NULL, date TEXT NOT NULL, chat_id TEXT NOT NULL, message_id TEXT NOT NULL,
          PRIMARY KEY(group_id, date)
        )""")
        if conn.postgres:
            for table in ("group_telegram", "telegram_class_posts"):
                secured = conn.execute("SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass(?)", (table,)).fetchone()
                if not secured or not secured["relrowsecurity"]:
                    conn.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
ATTENDANCE_ORDER = {"present": 1, "late": 2, "absent": 3}
HOMEWORK_LABELS = {"done": "Done", "partial": "Partial", "not_done": "Not done"}
DIVIDER = "──────────────────"


def build_attendance_message(day: str, rows: list[dict]) -> str:
    """The daily class post parents already know from the academy's earlier spreadsheet bot."""
    title = f"{ACADEMY_NAME} | Attendance | {date.fromisoformat(day).strftime('%d %b %Y')}"
    lines = [f"<b>{html.escape(title)}</b>", DIVIDER, ""]
    ordered = sorted(rows, key=lambda row: (ATTENDANCE_ORDER.get(row["attendance"], 9), row["name"]))
    for index, row in enumerate(ordered, start=1):
        lines.append(f"<b>{index}. {html.escape(row['name'])}</b>")
        if row["attendance"] == "absent":
            lines += ["  ❌ Absent", ""]
            continue
        stars = max(0, min(5, int(row["stars"] or 0)))
        lines.append(f"  {row['attendance'].capitalize()} | {'★' * stars}{'☆' * (5 - stars)} | Last HW: {HOMEWORK_LABELS.get(row['hw'], '-')}")
        if row["next_hw"]:
            lines.append(f"  Next HW: <b><i>{html.escape(row['next_hw'])}</i></b>")
        lines.append("")
    lines += [DIVIDER, "<b><i>📖 My Lord! Increase me in knowledge. -Surah Taha 20:114</i></b>"]
    text = "\n".join(lines)
    if len(text) > 4000:
        # Cut on a line boundary so no HTML tag is left open.
        text = text[:3900].rsplit("\n", 1)[0] + "\n…"
    return text


def post_class_attendance(group_id: str, group_name: str, day: str) -> dict:
    """Post one group's class day to its Telegram chat; saving the day again edits that same post."""
    result = {"group": group_name}
    with connect() as conn:
        target = conn.execute("SELECT chat_id FROM group_telegram WHERE group_id=?", (group_id,)).fetchone()
        if not target or not target["chat_id"]:
            return {**result, "status": "not_connected"}
        rows = [dict(row) for row in conn.execute(
            """SELECT s.name, s.stars, s.hw, s.next_hw, a.present, a.status FROM attendance_records a
               JOIN students s ON s.id = a.student_id
               WHERE s.klass = ? AND a.date = ? AND s.enrollment_status = 'active'""", (group_name, day)).fetchall()]
        previous = conn.execute("SELECT chat_id, message_id FROM telegram_class_posts WHERE group_id=? AND date=?", (group_id, day)).fetchone()
    if not BOT_TOKEN:
        return {**result, "status": "failed", "detail": "Telegram bot is not configured"}
    if not rows:
        return {**result, "status": "skipped"}
    for row in rows:
        row["attendance"] = row["status"] or ("present" if row["present"] else "absent")
    chat_id = target["chat_id"]
    payload = {"chat_id": chat_id, "text": build_attendance_message(day, rows), "parse_mode": "HTML"}
    try:
        if previous and previous["chat_id"] == chat_id:
            try:
                _call("editMessageText", {**payload, "message_id": int(previous["message_id"])})
                return {**result, "status": "updated"}
            except HTTPException as exc:
                if "not modified" in str(exc.detail):
                    return {**result, "status": "updated"}
                # The earlier post was deleted or is too old to edit: fall through and post again.
        message = _call("sendMessage", payload)
    except HTTPException as exc:
        logger.warning("Attendance post for %s failed: %s", group_name, exc.detail)
        return {**result, "status": "failed", "detail": str(exc.detail)}
    with connect() as conn:
        conn.execute("""INSERT INTO telegram_class_posts(group_id, date, chat_id, message_id) VALUES (?, ?, ?, ?)
                     ON CONFLICT(group_id, date) DO UPDATE SET chat_id=excluded.chat_id, message_id=excluded.message_id""",
                     (group_id, day, chat_id, str(message.get("message_id"))))
    return {**result, "status": "sent"}


def refresh_posted_attendance(student_id: str, day: str) -> dict | None:
    """After a single-student correction, update the group's post for that day if one was already sent."""
    with connect() as conn:
        group = conn.execute(
            """SELECT g.id, g.name FROM class_groups g JOIN students s ON s.klass = g.name
               JOIN telegram_class_posts p ON p.group_id = g.id AND p.date = ? WHERE s.id = ?""", (day, student_id)).fetchone()
    if not group:
        return None
    return post_class_attendance(group["id"], group["name"], day)


def send_group_test(group_id: str) -> None:
    with connect() as conn:
        target = conn.execute("SELECT chat_id FROM group_telegram WHERE group_id=?", (group_id,)).fetchone()
    if not target or not target["chat_id"]:
        raise HTTPException(409, "Save a Telegram chat ID for this group first")
    _call("sendMessage", {"chat_id": target["chat_id"], "text": f"✅ {ACADEMY_NAME}: this group is connected. Daily attendance will be posted here."})
