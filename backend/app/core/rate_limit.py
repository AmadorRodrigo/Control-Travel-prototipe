from collections import defaultdict, deque
from threading import Lock
from time import time


class InMemoryRateLimiter:
    """
    Implementação simples e barata para ambiente com uma única instância.
    Em cenários com múltiplas réplicas, substitua por Redis compartilhado.
    """

    def __init__(self) -> None:
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        current_time = time()

        with self._lock:
            bucket = self._requests[key]
            self._trim(bucket, current_time, window_seconds)

            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (current_time - bucket[0])))
                return False, retry_after

            bucket.append(current_time)
            return True, 0

    @staticmethod
    def _trim(bucket: deque[float], current_time: float, window_seconds: int) -> None:
        while bucket and current_time - bucket[0] >= window_seconds:
            bucket.popleft()


rate_limiter = InMemoryRateLimiter()
