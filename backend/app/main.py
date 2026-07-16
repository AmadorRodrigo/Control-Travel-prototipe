from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine
from app.core.security import get_password_hash
from app.models import User
from app.routes.auth import router as auth_router
from app.routes.passageiros import router as passageiros_router
from app.routes.viagens import router as viagens_router


def seed_default_admin() -> None:
    with Session(engine) as session:
        existing_admin = (
            session.query(User)
            .filter(User.username == settings.default_admin_username)
            .first()
        )
        if existing_admin:
            return

        admin = User(
            username=settings.default_admin_username,
            email=settings.default_admin_email,
            password_hash=get_password_hash(settings.default_admin_password),
            is_active=True,
        )
        session.add(admin)
        session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    seed_default_admin()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)

app.add_middleware(GZipMiddleware, minimum_size=512)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts_list or ["*"],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://127.0.0.1:5173",
        "http://192.168.150.6:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
"""alteraçoes aqui no middleware para teste em sistemas operacionais diferentes""""

@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


app.include_router(auth_router)
app.include_router(passageiros_router)
app.include_router(viagens_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "environment": settings.app_env,
    }
