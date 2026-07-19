from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http import get_client_ip
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    get_token_hash,
    verify_password,
)
from app.dependencies import enforce_rate_limit, get_current_user, get_db
from app.models import Passageiro, RefreshSession, User
from app.schemas import AdminSetupRequest, AuthSessionResponse, FirstAccessRequest, LoginRequest, SetupStatusResponse, UserRead


router = APIRouter(prefix="/api/auth", tags=["Autenticação"])

# Dummy hash used to prevent timing side-channel when user is not found.
# Verification will always fail, but takes the same time as a real check.
_DUMMY_HASH = get_password_hash("dummy-constant-time-placeholder")


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


def _revoke_excess_sessions(user_id: int, db: Session) -> None:
    now = datetime.now(timezone.utc)
    active_sessions = (
        db.query(RefreshSession)
        .filter(
            RefreshSession.user_id == user_id,
            RefreshSession.revoked_at.is_(None),
            RefreshSession.expires_at > now,
        )
        .order_by(RefreshSession.created_at.asc())
        .all()
    )
    excess = len(active_sessions) - settings.max_sessions_per_user + 1
    if excess > 0:
        for old_session in active_sessions[:excess]:
            old_session.revoked_at = now


def create_user_session(
    *,
    user: User,
    request: Request,
    db: Session,
) -> tuple[str, str]:
    _revoke_excess_sessions(user.id, db)

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

    access_token = create_access_token(
        subject=str(user.id),
        username=user.username,
        token_version=user.token_version,
    )
    return refresh_token, access_token


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

    if "@" in payload.username:
        user = db.query(User).filter(User.email == payload.username).first()
    else:
        user = db.query(User).filter(User.username == payload.username).first()

    # Always run password verification to prevent timing-based user enumeration
    candidate_hash = user.password_hash if user else _DUMMY_HASH
    password_ok = verify_password(payload.password, candidate_hash)

    if not user or not password_ok:
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


@router.get("/setup-status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)) -> SetupStatusResponse:
    has_admin = db.query(User).filter(User.is_admin.is_(True)).first() is not None
    return SetupStatusResponse(needs_setup=not has_admin)


@router.post("/setup-admin", response_model=AuthSessionResponse)
def setup_admin(
    payload: AdminSetupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    has_admin = db.query(User).filter(User.is_admin.is_(True)).first() is not None
    if has_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um administrador cadastrado.",
        )

    if db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.email)
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Usuário ou e-mail já cadastrado.",
        )

    admin = User(
        username=payload.username,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        is_active=True,
        is_admin=True,
    )
    db.add(admin)
    db.flush()

    refresh_token, access_token = create_user_session(user=admin, request=request, db=db)
    db.commit()
    set_refresh_cookie(response, refresh_token)
    return AuthSessionResponse(
        access_token=access_token,
        user=UserRead.model_validate(admin),
    )


@router.post("/setup", response_model=AuthSessionResponse)
def first_access_setup(
    payload: FirstAccessRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    client_ip = get_client_ip(request)
    enforce_rate_limit(
        key=f"setup:ip:{client_ip}",
        limit=settings.setup_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas tentativas de configuração. Aguarde um minuto.",
    )
    enforce_rate_limit(
        key=f"setup:doc:{payload.documento}",
        limit=settings.setup_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas tentativas para este documento. Aguarde um minuto.",
    )

    # Use a generic error for both "document not found" and "wrong email on existing account"
    # to prevent document enumeration.
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas. Verifique o documento e o e-mail informados.",
    )

    passageiro = db.query(Passageiro).filter(Passageiro.documento == payload.documento).first()
    if not passageiro:
        # Perform a dummy verify to keep response time consistent
        verify_password("dummy", _DUMMY_HASH)
        raise _invalid

    if passageiro.linked_user_id:
        # Account already exists — validate email matches before resetting password
        user = db.query(User).filter(User.id == passageiro.linked_user_id).first()
        if not user or not user.is_active:
            raise _invalid
        if user.email.lower() != payload.email.lower():
            raise _invalid
        user.password_hash = get_password_hash(payload.new_password)
        user.token_version = (user.token_version + 1) % 2_147_483_647
    else:
        # No account yet — create one and link it
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este e-mail já está vinculado a outra conta.",
            )
        username = payload.documento[:50]
        if db.query(User).filter(User.username == username).first():
            username = (payload.documento[:46] + payload.email[:3])[:50]

        user = User(
            username=username,
            email=payload.email,
            password_hash=get_password_hash(payload.new_password),
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.flush()
        passageiro.linked_user_id = user.id

    refresh_token, access_token = create_user_session(user=user, request=request, db=db)
    db.commit()
    set_refresh_cookie(response, refresh_token)
    return AuthSessionResponse(
        access_token=access_token,
        user=UserRead.model_validate(user),
    )
