from collections import defaultdict, deque
from threading import Lock
from time import monotonic


class InMemoryRateLimiter:
    """
    Implementação simples e barata para ambiente com um único processo.
    Em cenários com múltiplos workers ou réplicas, substitua por Redis compartilhado.
    """

    def __init__(self) -> None:
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._windows: dict[str, int] = {}
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        current_time = monotonic()

        with self._lock:
            self._windows[key] = window_seconds
            bucket = self._requests[key]
            self._trim(bucket, current_time, window_seconds)

            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (current_time - bucket[0])))
                return False, retry_after

            bucket.append(current_time)
            return True, 0

    def cleanup(self) -> int:
        current_time = monotonic()
        removed = 0
        with self._lock:
            for key in list(self._requests):
                bucket = self._requests[key]
                self._trim(bucket, current_time, self._windows[key])
                if not bucket:
                    del self._requests[key]
                    del self._windows[key]
                    removed += 1
        return removed

    @staticmethod
    def _trim(bucket: deque[float], current_time: float, window_seconds: int) -> None:
        while bucket and current_time - bucket[0] >= window_seconds:
            bucket.popleft()


rate_limiter = InMemoryRateLimiter()
