import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from passlib.context import CryptContext

from app.core.config import settings


_ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)

# Legacy bcrypt verifier — used only to verify existing hashes during migration.
# New passwords are always hashed with argon2.
_bcrypt_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("$argon2"):
        try:
            return _ph.verify(hashed_password, plain_password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False
    # Legacy bcrypt hash (starts with $2b$ or $2a$)
    try:
        return _bcrypt_ctx.verify(
            hashlib.sha256(plain_password.encode("utf-8")).hexdigest(),
            hashed_password,
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return _ph.hash(password)


def create_access_token(
    *,
    subject: str,
    username: str,
    token_version: int = 0,
    expires_delta: timedelta | None = None,
) -> str:
    expire_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "username": username,
        "type": "access",
        "ver": token_version,
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
