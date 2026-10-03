"""Academy-local dates. The server runs in UTC; class days and due dates follow the academy's timezone."""
from __future__ import annotations

import os
from datetime import date, datetime, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore[assignment]

ACADEMY_TIMEZONE = os.getenv("ACADEMY_TIMEZONE", "America/New_York").strip() or "America/New_York"


def academy_now() -> datetime:
    if ACADEMY_TIMEZONE.lower() == "local" or ZoneInfo is None:
        return datetime.now().astimezone()
    try:
        return datetime.now(ZoneInfo(ACADEMY_TIMEZONE))
    except Exception:
        # Missing tzdata must never take the API down; fall back to UTC.
        return datetime.now(timezone.utc)


def academy_today() -> date:
    return academy_now().date()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
