from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any


TOKEN_TTL_SECONDS = int(os.getenv("JWT_TTL_SECONDS", "43200"))
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-before-production")


def validate_security_config() -> None:
    if os.getenv("APP_ENV", "development").lower() == "production" and (
        JWT_SECRET == "change-this-secret-before-production" or len(JWT_SECRET) < 32
    ):
        raise RuntimeError("Production requires a random JWT_SECRET of at least 32 characters")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(f"{raw}{padding}".encode("ascii"))


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    password_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), password_salt.encode("utf-8"), 160_000)
    return _b64url_encode(digest), password_salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    candidate_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate_hash, stored_hash)


def create_token(payload: dict[str, Any]) -> str:
    now = int(time.time())
    body = {**payload, "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = ".".join(
        [
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(body, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_token(token: str) -> dict[str, Any]:
    try:
        header, body, signature = token.split(".")
    except ValueError as exc:
        raise ValueError("Invalid token") from exc

    signing_input = f"{header}.{body}"
    expected = hmac.new(JWT_SECRET.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    supplied = _b64url_decode(signature)
    if not hmac.compare_digest(expected, supplied):
        raise ValueError("Invalid token signature")

    payload = json.loads(_b64url_decode(body))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Token expired")
    return payload
