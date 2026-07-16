from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http import get_client_ip
from app.core.rate_limit import rate_limiter
from app.core.security import decode_token
from app.core.database import SessionLocal
from app.models import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado ou token inválido.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        token_type = payload.get("type")
        user_id = payload.get("sub")
        if token_type != "access" or not user_id:
            raise credentials_exception
    except Exception as exc:
        raise credentials_exception from exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise credentials_exception

    return user


def enforce_rate_limit(*, key: str, limit: int, window_seconds: int, detail: str) -> None:
    allowed, retry_after = rate_limiter.hit(
        key=key,
        limit=limit,
        window_seconds=window_seconds,
    )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )


def enforce_authenticated_read_rate_limit(request: Request, user: User) -> None:
    client_ip = get_client_ip(request)
    enforce_rate_limit(
        key=f"read:user:{user.username}",
        limit=settings.authenticated_read_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas consultas em sequência. Aguarde alguns segundos e tente novamente.",
    )
    enforce_rate_limit(
        key=f"read:ip:{client_ip}",
        limit=settings.authenticated_read_rate_limit_per_minute * 2,
        window_seconds=60,
        detail="Volume elevado de consultas deste endereço. Aguarde e tente novamente.",
    )


def enforce_authenticated_write_rate_limit(request: Request, user: User) -> None:
    client_ip = get_client_ip(request)
    enforce_rate_limit(
        key=f"write:user:{user.username}",
        limit=settings.authenticated_write_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas gravações em sequência. Aguarde alguns segundos e tente novamente.",
    )
    enforce_rate_limit(
        key=f"write:ip:{client_ip}",
        limit=settings.authenticated_write_rate_limit_per_minute * 2,
        window_seconds=60,
        detail="Volume elevado de escrita deste endereço. Aguarde e tente novamente.",
    )
