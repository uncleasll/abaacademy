from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import HTTPException

from .database import connect

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "").strip().lstrip("@")
WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "").strip().rstrip("/")
logger = logging.getLogger("aba.telegram")


def header_secret() -> str:
    """Telegram only allows [A-Za-z0-9_-] in secret_token, so send a digest of the configured secret."""
    return hashlib.sha256(WEBHOOK_SECRET.encode()).hexdigest()


def _call(method: str, payload: dict) -> dict:
    if not BOT_TOKEN:
        raise HTTPException(503, "Telegram bot is not configured")
    request = Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
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
        conn.execute("""CREATE TABLE IF NOT EXISTS telegram_links (
          token TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL, used_at TEXT
        )""")
        if conn.postgres:
            secured = conn.execute("SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('telegram_links')").fetchone()
            if not secured or not secured["relrowsecurity"]:
                conn.execute("ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY")
    if BOT_TOKEN and PUBLIC_API_URL and WEBHOOK_SECRET:
        try:
            _call("setWebhook", {
                "url": f"{PUBLIC_API_URL}/api/telegram/webhook/{WEBHOOK_SECRET}",
                "allowed_updates": ["message"],
                "drop_pending_updates": False,
                "secret_token": header_secret(),
            })
        except HTTPException as exc:
            # A Telegram outage must not keep the academy API from starting.
            logger.warning("Telegram webhook was not registered: %s", exc.detail)


def create_link(student_id: str) -> str:
    if not BOT_USERNAME:
        raise HTTPException(503, "TELEGRAM_BOT_USERNAME is not configured")
    token = uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    with connect() as conn:
        if not conn.execute("SELECT id FROM students WHERE id=?", (student_id,)).fetchone():
            raise HTTPException(404, "Student not found")
        conn.execute("DELETE FROM telegram_links WHERE student_id=? AND used_at IS NULL", (student_id,))
        conn.execute("INSERT INTO telegram_links VALUES (?, ?, ?, NULL)", (token, student_id, expires))
    return f"https://t.me/{BOT_USERNAME}?start={token}"


def _reply(chat_id: str, text: str) -> None:
    try:
        _call("sendMessage", {"chat_id": chat_id, "text": text})
    except HTTPException as exc:
        logger.warning("Telegram reply failed: %s", exc.detail)


def accept_update(update: dict) -> None:
    message = update.get("message") or {}
    text = str(message.get("text") or "").strip()
    if not text.startswith("/start "):
        return
    token = text.split(maxsplit=1)[1].strip()
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "")
    if not chat_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    student = None
    with connect() as conn:
        link = conn.execute("SELECT * FROM telegram_links WHERE token=? AND used_at IS NULL", (token,)).fetchone()
        if link and link["expires_at"] >= now:
            username = str((message.get("from") or {}).get("username") or "")
            conn.execute("UPDATE students SET telegram_chat_id=?, telegram_username=? WHERE id=?", (chat_id, username, link["student_id"]))
            conn.execute("UPDATE telegram_links SET used_at=? WHERE token=?", (now, token))
            student = conn.execute("SELECT name FROM students WHERE id=?", (link["student_id"],)).fetchone()
    # Replies are sent after the link is committed; a failed reply must not undo or retry the connection.
    if student:
        _reply(chat_id, f"✅ Telegram connected for {student['name']}. ABA Academy can now send tuition reminders here.")
    else:
        _reply(chat_id, "This connection link is invalid or expired. Please request a new link from ABA Academy.")


def send_balance_reminder(student_id: str, invoice_id: str | None = None) -> dict:
    with connect() as conn:
        student = conn.execute("SELECT * FROM students WHERE id=?", (student_id,)).fetchone()
        if not student:
            raise HTTPException(404, "Student not found")
        if not student["telegram_chat_id"]:
            raise HTTPException(409, "Parent has not connected Telegram yet")
        params: tuple = (student_id,)
        condition = "i.student_id=?"
        if invoice_id:
            condition += " AND i.id=?"
            params = (student_id, invoice_id)
        rows = conn.execute(f"""SELECT i.*, COALESCE(SUM(CASE WHEN p.voided_at IS NULL THEN p.amount_cents ELSE 0 END),0) paid
          FROM invoices i LEFT JOIN payments p ON p.invoice_id=i.id WHERE {condition} AND i.voided_at IS NULL
          GROUP BY i.id ORDER BY i.due_date""", params).fetchall()
        open_rows = [row for row in rows if row["amount_cents"] > row["paid"]]
        if not open_rows:
            raise HTTPException(409, "No outstanding balance for this student")
        total = sum(row["amount_cents"] - row["paid"] for row in open_rows) / 100
        periods = ", ".join(str(row["period"]) for row in open_rows[:4])
        if len(open_rows) > 4:
            periods += f" +{len(open_rows) - 4} more"
        chat_id = student["telegram_chat_id"]
    text = (
        f"ABA Academy tuition reminder\n\n"
        f"Student: {student['name']}\n"
        f"Period: {periods}\n"
        f"Outstanding balance: ${total:,.2f}\n\n"
        "If you have already paid, please contact the academy so we can update the record. Thank you."
    )
    result = _call("sendMessage", {"chat_id": chat_id, "text": text})
    return {"ok": True, "messageId": result.get("message_id"), "amount": total}
