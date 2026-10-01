"""Password hashing and signed session cookies (stdlib only)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000  # OWASP 2023 minimum for PBKDF2-HMAC-SHA256
LEGACY_ITERATIONS = 120_000  # implied by the seeded 3-part hashes, which omit the count
SESSION_COOKIE = "cc_session"
SESSION_TTL = 60 * 60 * 24 * 7

# Without SESSION_SECRET in .env, a random key is used and sessions reset on restart.
_SECRET = (os.getenv("SESSION_SECRET") or secrets.token_hex(32)).encode()


def hash_password(password: str) -> str:
    """Store as pbkdf2_sha256$<iterations>$<salt>$<hex digest> so the cost can be raised later."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"{ALGORITHM}${ITERATIONS}${salt}${digest}"


# Checked when the email doesn't exist, so both failure paths take the same time.
_DUMMY_HASH = hash_password(secrets.token_hex(16))


def burn_time(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) == 3:
        algo, salt, expected = parts
        iterations = LEGACY_ITERATIONS
    elif len(parts) == 4:
        algo, iter_str, salt, expected = parts
        if not iter_str.isdigit():
            return False
        iterations = int(iter_str)
    else:
        return False
    if algo != ALGORITHM:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()
    return hmac.compare_digest(digest, expected)


LOCKOUT_WINDOW = 15 * 60
# Per account, and a looser cap per IP so shared networks aren't locked out together.
MAX_FAILURES = {"email": 5, "ip": 20}
_failures: dict[str, list[float]] = {}


def _recent(key: str) -> list[float]:
    cutoff = time.time() - LOCKOUT_WINDOW
    stamps = [t for t in _failures.get(key, []) if t > cutoff]
    _failures[key] = stamps
    return stamps


def is_locked(*keys: str) -> bool:
    return any(len(_recent(k)) >= MAX_FAILURES[k.split(":", 1)[0]] for k in keys)


def record_failure(*keys: str) -> None:
    now = time.time()
    for k in keys:
        _recent(k).append(now)


def clear_failures(*keys: str) -> None:
    for k in keys:
        _failures.pop(k, None)


def _sign(payload: str) -> str:
    return hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()


def make_session(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + SESSION_TTL}"
    token = f"{payload}.{_sign(payload)}"
    return base64.urlsafe_b64encode(token.encode()).decode()


def read_session(token: str | None) -> int | None:
    if not token:
        return None
    try:
        user_id, expires, sig = base64.urlsafe_b64decode(token.encode()).decode().split(".")
    except (ValueError, UnicodeDecodeError):
        return None
    if not hmac.compare_digest(sig, _sign(f"{user_id}.{expires}")):
        return None
    if not expires.isdigit() or int(expires) < time.time() or not user_id.isdigit():
        return None
    return int(user_id)
