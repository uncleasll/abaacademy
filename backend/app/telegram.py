from __future__ import annotations

import html
import json
import logging
import os
import re
import threading
import time
from datetime import date, timedelta
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from .clock import academy_now, academy_today
from .database import connect

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
API_BASE = os.getenv("TELEGRAM_API_BASE", "https://api.telegram.org").strip().rstrip("/")
ACADEMY_NAME = os.getenv("TELEGRAM_ACADEMY_NAME", "Al-Bukhari Academy").strip() or "Al-Bukhari Academy"
logger = logging.getLogger("aba.telegram")

# The academy's real class chats, carried over from the earlier spreadsheet bot: teacher → chat ids for G1, G2, ...
# TELEGRAM_GROUP_CHATS_JSON (same shape) replaces this list; "{}" turns automatic linking off.
DEFAULT_GROUP_CHATS: dict[str, list[str]] = {
    "Behzodjon": ["-1003382996965", "-1003680113409"],
    "Abdulquddus": ["-1003546618513", "-1003540540449"],
    "Firuz": ["-1003406651107"],
    "Adhamjon": ["-1003746564495"],
    "Abdulwahid": ["-1003764772695"],
}
# How often the server re-sends class days whose post never reached Telegram (0 disables the background check).
CATCHUP_SECONDS = int(os.getenv("TELEGRAM_CATCHUP_SECONDS", "1800") or 0)
CATCHUP_DAYS = 3
POSTING_KEY = "telegram_posting"
DAILY_RUN_KEY = "telegram_daily_last_run"
DEFAULT_POSTING = {"mode": "instant", "time": "09:30"}


def read_posting_settings(conn) -> dict:
    """How class days reach Telegram: "instant" (when the teacher saves) or "daily" (every day at a set academy-local time)."""
    row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (POSTING_KEY,)).fetchone()
    settings = dict(DEFAULT_POSTING)
    if row:
        try:
            saved = json.loads(row["value"])
            if saved.get("mode") in ("instant", "daily"):
                settings["mode"] = saved["mode"]
            if re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", str(saved.get("time", ""))):
                settings["time"] = saved["time"]
        except (ValueError, AttributeError):
            pass
    return settings


def save_posting_settings(conn, mode: str, time_of_day: str) -> dict:
    settings = {"mode": mode, "time": time_of_day}
    conn.execute("INSERT INTO app_settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (POSTING_KEY, json.dumps(settings)))
    return settings


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
    except HTTPError as exc:
        # Telegram answers 400/401/403 with a JSON description (wrong token, bot not in the group, chat not found).
        try:
            result = json.loads(exc.read())
        except ValueError:
            result = {}
        if exc.code == 401:
            raise HTTPException(502, "Telegram rejected the bot token: check TELEGRAM_BOT_TOKEN") from exc
        raise HTTPException(502, _explain(result.get("description") or f"Telegram error {exc.code}")) from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(502, "Telegram is temporarily unavailable") from exc
    if not result.get("ok"):
        raise HTTPException(502, _explain(result.get("description", "Telegram rejected the request")))
    return result["result"]


def _explain(description: str) -> str:
    lowered = description.lower()
    if "chat not found" in lowered or "kicked" in lowered or "not a member" in lowered or "forbidden" in lowered:
        return f"{description}. Add the academy bot to this Telegram group (as admin in a supergroup) or fix the chat ID"
    return description


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
    provision_group_chats()
    start_catchup_thread()


def configured_group_chats() -> dict[str, list[str]]:
    raw = os.getenv("TELEGRAM_GROUP_CHATS_JSON", "").strip()
    if not raw:
        return DEFAULT_GROUP_CHATS
    try:
        parsed = json.loads(raw)
        return {str(teacher): [str(chat) for chat in chats] for teacher, chats in parsed.items()}
    except (ValueError, AttributeError, TypeError):
        logger.error("TELEGRAM_GROUP_CHATS_JSON is not valid JSON; keeping the saved chat links only")
        return {}


def provision_group_chats() -> list[dict]:
    """Link each teacher's groups to their real Telegram chats once, so posting works without manual setup.

    A chat saved by staff is never overwritten, a chat already linked to another group is never linked twice,
    and a teacher who has fewer groups than chats gets the missing group created (editable on the Groups page).
    """
    linked: list[dict] = []
    configured = configured_group_chats()
    known = {chat for chats in configured.values() for chat in chats}
    with connect() as conn:
        if not conn.postgres:
            conn.execute("BEGIN IMMEDIATE")
        # A supergroup id typed without its "-100" prefix (e.g. -3546618513) can never reach Telegram: restore the real id.
        for row in conn.execute("SELECT t.group_id, t.chat_id, g.name FROM group_telegram t JOIN class_groups g ON g.id = t.group_id").fetchall():
            digits = row["chat_id"].lstrip("-")
            repaired = next((chat for chat in known if chat != row["chat_id"] and chat.lstrip("-").removeprefix("100") == digits.removeprefix("100")), None)
            if repaired and not conn.execute("SELECT 1 FROM group_telegram WHERE chat_id=?", (repaired,)).fetchone():
                conn.execute("UPDATE group_telegram SET chat_id=? WHERE group_id=?", (repaired, row["group_id"]))
                linked.append({"group": row["name"], "chatId": repaired, "repairedFrom": row["chat_id"]})
        used = {row["chat_id"] for row in conn.execute("SELECT chat_id FROM group_telegram").fetchall()}
        for teacher, chats in configured.items():
            groups = [dict(row) for row in conn.execute("SELECT id, name FROM class_groups WHERE teacher=? ORDER BY name", (teacher,)).fetchall()]
            slots: dict[int, dict] = {}
            unnumbered = []
            for group in groups:
                match = re.search(r"\bG\s?(\d+)\b", group["name"])
                index = int(match.group(1)) - 1 if match else None
                if index is not None and index not in slots:
                    slots[index] = group
                else:
                    unnumbered.append(group)
            # The provisioned "<Teacher> — General" group comes first among unnamed groups, then the rest by name.
            unnumbered.sort(key=lambda g: (not g["id"].startswith("group-"), g["name"]))
            for index in range(len(chats)):
                if index not in slots and unnumbered:
                    slots[index] = unnumbered.pop(0)
            for index, chat_id in enumerate(chats):
                if not chat_id or chat_id in used:
                    continue
                group = slots.get(index)
                if group is None:
                    group = {"id": f"group-{teacher.lower()}-g{index + 1}", "name": f"{teacher} — G{index + 1}"}
                    if conn.execute("SELECT 1 FROM class_groups WHERE id=? OR name=?", (group["id"], group["name"])).fetchone():
                        continue
                    conn.execute("INSERT INTO class_groups VALUES (?, ?, ?, ?, ?, ?, 0)",
                                 (group["id"], group["name"], teacher, "General", "Schedule not set", 30))
                if conn.execute("SELECT 1 FROM group_telegram WHERE group_id=?", (group["id"],)).fetchone():
                    continue
                conn.execute("INSERT INTO group_telegram(group_id, chat_id) VALUES (?, ?)", (group["id"], chat_id))
                used.add(chat_id)
                linked.append({"group": group["name"], "chatId": chat_id})
    for item in linked:
        logger.info("Linked Telegram chat %s to group %s", item["chatId"], item["group"])
    return linked


def catch_up_missing_posts(days: int = CATCHUP_DAYS, force: bool = False) -> list[dict]:
    """Post every recent class day that has attendance but no Telegram post yet (Telegram was down, the chat was linked later,
    or posting is set to the daily run)."""
    today = academy_today()
    since = (today - timedelta(days=days)).isoformat()
    with connect() as conn:
        pending = conn.execute(
            """SELECT DISTINCT g.id, g.name, a.date FROM class_groups g
               JOIN group_telegram t ON t.group_id = g.id
               JOIN students s ON s.klass = g.name AND s.enrollment_status = 'active'
               JOIN attendance_records a ON a.student_id = s.id
               LEFT JOIN telegram_class_posts p ON p.group_id = g.id AND p.date = a.date
               WHERE a.date >= ? AND a.date <= ? AND p.group_id IS NULL ORDER BY a.date, g.name""",
            (since, today.isoformat())).fetchall()
    results = []
    for row in pending:
        result = post_class_attendance(row["id"], row["name"], row["date"], force=force)
        results.append({**result, "date": row["date"]})
    return results


def run_daily_post_if_due() -> list[dict] | None:
    """In daily mode, post all unposted class days once per day after the configured academy-local time."""
    now = academy_now()
    today = now.date().isoformat()
    with connect() as conn:
        posting = read_posting_settings(conn)
        if posting["mode"] != "daily" or now.strftime("%H:%M") < posting["time"]:
            return None
        last = conn.execute("SELECT value FROM app_settings WHERE key = ?", (DAILY_RUN_KEY,)).fetchone()
        if last and last["value"] == today:
            return None
        conn.execute("INSERT INTO app_settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (DAILY_RUN_KEY, today))
    return catch_up_missing_posts(force=True)


_catchup_started = False


def start_catchup_thread() -> None:
    global _catchup_started
    if _catchup_started or CATCHUP_SECONDS <= 0 or not BOT_TOKEN:
        return
    _catchup_started = True

    def loop() -> None:
        # Checks every minute: the daily run fires once after its time; in instant mode missed posts are retried every CATCHUP_SECONDS.
        tick = min(60, CATCHUP_SECONDS)
        next_catchup = time.monotonic() + tick
        while True:
            time.sleep(tick)
            try:
                for item in run_daily_post_if_due() or []:
                    logger.info("Daily post for %s on %s: %s", item["group"], item["date"], item["status"])
                if time.monotonic() >= next_catchup:
                    next_catchup = time.monotonic() + CATCHUP_SECONDS
                    for item in catch_up_missing_posts():
                        logger.info("Catch-up post for %s on %s: %s", item["group"], item["date"], item["status"])
            except Exception:  # pragma: no cover - the background loop must survive any database or network error
                logger.exception("Telegram background posting failed")

    threading.Thread(target=loop, name="telegram-catchup", daemon=True).start()
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
        lines.append(f"  {row['attendance'].capitalize()} | {'⭐' * stars or '-'} | Last HW: {HOMEWORK_LABELS.get(row['hw'], '-')}")
        if row["next_hw"]:
            lines.append(f"  Next HW: <b><i>{html.escape(row['next_hw'])}</i></b>")
        lines.append("")
    lines += [DIVIDER, "<b><i>📖 My Lord! Increase me in knowledge. -Surah Taha 20:114</i></b>"]
    text = "\n".join(lines)
    if len(text) > 4000:
        # Cut on a line boundary so no HTML tag is left open.
        text = text[:3900].rsplit("\n", 1)[0] + "\n…"
    return text


def post_class_attendance(group_id: str, group_name: str, day: str, force: bool = False) -> dict:
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
        posting = read_posting_settings(conn)
    if not BOT_TOKEN:
        return {**result, "status": "failed", "detail": "Telegram bot is not configured"}
    if not rows:
        return {**result, "status": "skipped"}
    if posting["mode"] == "daily" and not previous and not force:
        # The daily run posts it at the configured time; a day already posted is still edited right away.
        return {**result, "status": "scheduled", "detail": posting["time"]}
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
