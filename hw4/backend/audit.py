"""Append-only audit trail of what the agent does: output/audit_trail.json (a JSON array).

Rules:
- Entries are only ever added. The file is never truncated or reset between runs or restarts.
- If the file is ever unreadable, it is renamed aside (audit_trail.corrupt-<time>.json) and a
  new one is started, so no history is destroyed.
- No customer message text, replies, emails or passwords are stored. Tool arguments and results
  are short, and anything that looks like an email address or a long number is masked.
- A failure to write the audit must never break a chat, so errors are logged and swallowed.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = Path(os.getenv("AUDIT_TRAIL_PATH") or ROOT / "output" / "audit_trail.json")

MAX_ARGS_CHARS = 120
MAX_RESULT_CHARS = 220

log = logging.getLogger("campus_customs.audit")
_lock = threading.Lock()

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_LONG_NUMBER = re.compile(r"\d[\d\s-]{9,}\d")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def scrub(text: str) -> str:
    """Mask email addresses and long digit runs (card / phone numbers) before anything is stored."""
    return _LONG_NUMBER.sub("[number]", _EMAIL.sub("[email]", text))


def clip(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def short_args(args: dict) -> str:
    used = {k: v for k, v in args.items() if v not in (None, "", [])}
    return clip(scrub(json.dumps(used, ensure_ascii=False, default=str)), MAX_ARGS_CHARS)


def short_result(text: str) -> str:
    return clip(scrub(text), MAX_RESULT_CHARS)


def _quarantine(reason: str) -> None:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    aside = AUDIT_PATH.with_name(f"audit_trail.corrupt-{stamp}.json")
    AUDIT_PATH.replace(aside)
    log.error("audit trail was unreadable (%s); kept a copy at %s and started a new file", reason, aside.name)


def append_entry(entry: dict) -> None:
    try:
        with _lock:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            entries: list = []
            if AUDIT_PATH.exists() and AUDIT_PATH.stat().st_size > 0:
                try:
                    loaded = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
                    entries = loaded if isinstance(loaded, list) else [loaded]
                except json.JSONDecodeError as exc:
                    _quarantine(str(exc))
            entries.append(entry)
            tmp = AUDIT_PATH.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            tmp.replace(AUDIT_PATH)
    except Exception:  # noqa: BLE001 - auditing must never break the shop
        log.exception("could not write the audit trail")
