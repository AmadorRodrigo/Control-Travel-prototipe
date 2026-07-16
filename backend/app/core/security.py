import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _prehash_password(password: str) -> str:
    # bcrypt truncates at 72 bytes; SHA-256 digest fits in 64 hex chars (well under limit)
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(_prehash_password(plain_password), hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(_prehash_password(password))


def create_access_token(
    *,
    subject: str,
    username: str,
    expires_delta: timedelta | None = None,
) -> str:
    expire_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "username": username,
        "type": "access",
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(
    *,
    subject: str,
    username: str,
    jti: str | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[str, str, datetime]:
    refresh_jti = jti or str(uuid.uuid4())
    expire_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.refresh_token_expire_days)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "username": username,
        "type": "refresh",
        "jti": refresh_jti,
        "exp": expire_at,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token, refresh_jti, expire_at


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def get_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_token_invalid(token: str) -> bool:
    try:
        decode_token(token)
        return False
    except JWTError:
        return True
