"""Small in-memory sliding-window rate limiter (per process; resets on restart)."""

from __future__ import annotations

import math
import os
import time
from collections import defaultdict, deque

CHAT_LIMIT = int(os.getenv("CHAT_RATE_LIMIT_PER_MIN", "10"))
WINDOW_SECONDS = 60


class RateLimiter:
    def __init__(self, limit: int, window: float = WINDOW_SECONDS) -> None:
        self.limit = limit
        self.window = window
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> int:
        """Record a hit. Returns 0 if allowed, else the seconds to wait before retrying."""
        now = time.monotonic()
        hits = self._hits[key]
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return max(1, math.ceil(hits[0] + self.window - now))
        hits.append(now)
        if not hits:
            self._hits.pop(key, None)
        return 0


chat_limiter = RateLimiter(CHAT_LIMIT)
