from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http import get_client_ip
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_hash,
    verify_password,
)
from app.dependencies import enforce_rate_limit, get_current_user, get_db
from app.models import RefreshSession, User
from app.schemas import AuthSessionResponse, LoginRequest, UserRead


router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


def create_user_session(
    *,
    user: User,
    request: Request,
    db: Session,
) -> tuple[str, str]:
    refresh_token, refresh_jti, refresh_expires_at = create_refresh_token(
        subject=str(user.id),
        username=user.username,
    )
    session = RefreshSession(
        user_id=user.id,
        jti=refresh_jti,
        token_hash=get_token_hash(refresh_token),
        created_by_ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        expires_at=refresh_expires_at,
    )
    db.add(session)
    return refresh_token, create_access_token(subject=str(user.id), username=user.username)


@router.post("/login", response_model=AuthSessionResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    client_ip = get_client_ip(request)
    normalized_username = payload.username.strip().lower()

    enforce_rate_limit(
        key=f"login:ip:{client_ip}",
        limit=settings.login_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas tentativas de login deste endereço. Aguarde um minuto e tente novamente.",
    )
    enforce_rate_limit(
        key=f"login:username:{normalized_username}",
        limit=settings.login_username_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas tentativas para este usuário. Aguarde um minuto e tente novamente.",
    )

    user = db.query(User).filter(User.username == payload.username).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo.",
        )

    refresh_token, access_token = create_user_session(user=user, request=request, db=db)
    db.commit()
    set_refresh_cookie(response, refresh_token)
    return AuthSessionResponse(
        access_token=access_token,
        user=UserRead.model_validate(user),
    )


@router.post("/refresh", response_model=AuthSessionResponse)
def refresh_session(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )

    try:
        payload = decode_token(refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido.",
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tipo de token inválido para renovação.",
        )

    session = (
        db.query(RefreshSession)
        .filter(RefreshSession.jti == payload.get("jti"))
        .first()
    )
    now = datetime.now(timezone.utc)

    if (
        not session
        or session.revoked_at is not None
        or session.expires_at <= now
        or session.token_hash != get_token_hash(refresh_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão de refresh inválida ou revogada.",
        )

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não autorizado para renovar sessão.",
        )

    session.revoked_at = now
    new_refresh_token, new_access_token = create_user_session(user=user, request=request, db=db)
    db.commit()
    set_refresh_cookie(response, new_refresh_token)
    return AuthSessionResponse(
        access_token=new_access_token,
        user=UserRead.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
    db: Session = Depends(get_db),
) -> Response:
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            session = (
                db.query(RefreshSession)
                .filter(RefreshSession.jti == payload.get("jti"))
                .first()
            )
            if session and session.revoked_at is None:
                session.revoked_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            db.rollback()

    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
