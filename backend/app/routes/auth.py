import secrets
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_password_reset_email
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
from app.models import Passageiro, PasswordResetToken, RefreshSession, User
from app.schemas import (
    AdminSetupRequest,
    AuthSessionResponse,
    FirstAccessRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    LoginRequest,
    SetupStatusResponse,
    UserRead,
)


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
        user = (
            db.query(User)
            .filter(User.email == payload.username)
            .with_for_update()
            .first()
        )
    else:
        user = (
            db.query(User)
            .filter(User.username == payload.username)
            .with_for_update()
            .first()
        )

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
    refresh_token: str | None = Cookie(
        default=None, alias=settings.refresh_cookie_name
    ),
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    validate_cookie_origin(request)
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
    user = None
    if session:
        user = (
            db.query(User).filter(User.id == session.user_id).with_for_update().first()
        )
        db.refresh(session)
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

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não autorizado para renovar sessão.",
        )

    session.revoked_at = now
    new_refresh_token, new_access_token = create_user_session(
        user=user, request=request, db=db
    )
    db.commit()
    set_refresh_cookie(response, new_refresh_token)
    return AuthSessionResponse(
        access_token=new_access_token,
        user=UserRead.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(
        default=None, alias=settings.refresh_cookie_name
    ),
    db: Session = Depends(get_db),
) -> Response:
    validate_cookie_origin(request)
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
    enforce_rate_limit(
        key=f"setup-admin:ip:{get_client_ip(request)}",
        limit=settings.setup_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas tentativas de configuração. Aguarde um minuto.",
    )
    has_admin = db.query(User).filter(User.is_admin.is_(True)).first() is not None
    if has_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um administrador cadastrado.",
        )

    if (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.email))
        .first()
    ):
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

    refresh_token, access_token = create_user_session(
        user=admin, request=request, db=db
    )
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

    passageiro = (
        db.query(Passageiro)
        .filter(Passageiro.documento == payload.documento)
        .with_for_update()
        .first()
    )
    if not passageiro:
        # Perform a dummy verify to keep response time consistent
        verify_password("dummy", _DUMMY_HASH)
        raise _invalid

    if passageiro.linked_user_id:
        # Existing accounts must prove ownership through email recovery.
        raise _invalid
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


def validate_cookie_origin(request: Request) -> None:
    # Required when cross-site deployments use SameSite=None. CORS alone does
    # not stop browsers from sending a request whose response is unreadable.
    origin = request.headers.get("origin")
    if origin is not None and origin not in settings.cors_origins_list:
        raise HTTPException(status_code=403, detail="Origem não autorizada.")
    if origin is None and (
        settings.cookie_samesite == "none"
        or request.headers.get("sec-fetch-site") == "cross-site"
    ):
        raise HTTPException(status_code=403, detail="Origem não autorizada.")


def limit_password_recovery(request: Request, action: str) -> None:
    enforce_rate_limit(
        key=f"{action}:ip:{get_client_ip(request)}",
        limit=settings.password_reset_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas tentativas. Aguarde um minuto e tente novamente.",
    )


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    limit_password_recovery(request, "forgot-password")
    enforce_rate_limit(
        key=f"forgot-password:email:{get_token_hash(payload.email.lower())}",
        limit=settings.password_reset_rate_limit_per_minute,
        window_seconds=60,
        detail="Muitas tentativas. Aguarde um minuto e tente novamente.",
    )
    user = (
        db.query(User)
        .filter(User.email == payload.email, User.is_active.is_(True))
        .with_for_update()
        .first()
    )
    if user:
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=get_token_hash(token),
                expires_at=now
                + timedelta(minutes=settings.password_reset_expire_minutes),
            )
        )
        db.commit()
        # Send after responding so SMTP latency cannot reveal account existence.
        background_tasks.add_task(send_password_reset_email, user.email, token)
    return {
        "message": "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha."
    }


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    limit_password_recovery(request, "reset-password")
    invalid = HTTPException(
        status_code=400, detail="Link inválido ou expirado. Solicite um novo link."
    )
    token_hash = get_token_hash(payload.token)
    candidate = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )
    if not candidate:
        raise invalid
    # Lock the user first to serialize resets (including different tokens),
    # logins and refreshes. Then reload the token after acquiring the lock.
    user = db.query(User).filter(User.id == candidate.user_id).with_for_update().first()
    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.id == candidate.id,
        )
        .populate_existing()
        .with_for_update()
        .first()
    )
    now = datetime.now(timezone.utc)
    if (
        not user
        or not user.is_active
        or not reset_token
        or reset_token.used_at
        or reset_token.expires_at <= now
    ):
        raise invalid
    user.password_hash = get_password_hash(payload.new_password)
    user.token_version = (user.token_version + 1) % 2_147_483_647
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)
    db.query(RefreshSession).filter(
        RefreshSession.user_id == user.id,
        RefreshSession.revoked_at.is_(None),
    ).update({RefreshSession.revoked_at: now}, synchronize_session=False)
    db.commit()
    clear_refresh_cookie(response)
    return {"message": "Senha redefinida. Faça login com sua nova senha."}
