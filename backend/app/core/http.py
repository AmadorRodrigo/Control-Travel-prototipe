from fastapi import Request

from app.core.config import settings


def get_client_ip(request: Request) -> str:
    # Only trust X-Forwarded-For when the direct connection comes from a known trusted proxy.
    # If no trusted proxies are configured, always use the real socket IP.
    client_host = request.client.host if request.client else None

    if client_host and client_host in settings.trusted_proxies_set:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the leftmost (client) IP from the chain
            return forwarded_for.split(",")[0].strip()

    return client_host or "unknown"
