# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Docker (preferred)
```bash
docker compose up --build                                 # dev: frontend :5173, backend :8000
docker compose -f docker-compose.prod.yml up --build -d  # prod: Nginx :80
```

### Frontend (`frontend/`)
```bash
npm run dev      # Vite dev server on 0.0.0.0:5173
npm run build    # Build to dist/
npm run preview  # Preview production build
```

### Backend (`backend/`)
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload  # dev server

# Migrations (Alembic)
alembic upgrade head
alembic revision --autogenerate -m "description"
alembic downgrade -1
```

No test runner or linter is configured in either project.

## Architecture

Full-stack monorepo: `backend/` (FastAPI + PostgreSQL), `frontend/` (React + Vite), `infra/` (Nginx prod config).

### Backend (`backend/app/`)

- **`main.py`** — App factory. Registers all routers, middleware stack (GZip, TrustedHost, CORS, security headers), and a lifespan handler that seeds the default admin user.
- **`models.py`** — SQLAlchemy 2.0 ORM. Core entities: `User`, `Passageiro`, `Viagem`, `Assento`, `RefreshSession`, `IdempotencyKey`. `Assento` rows are auto-generated when a `Viagem` is created (split into `inferior`/`superior` floors).
- **`schemas.py`** — Pydantic v2 request/response models.
- **`dependencies.py`** — FastAPI DI: `get_db` (session per request), `get_current_user` (JWT validation), rate-limit enforcers.
- **`core/security.py`** — JWT creation/decoding + bcrypt hashing (with SHA-256 pre-hash to handle bcrypt's 72-byte limit).
- **`core/rate_limit.py`** — In-memory sliding-window rate limiter. Not safe for horizontal scaling (no shared state).
- **Routes:** `routes/auth.py` (`/api/auth/*`), `routes/passageiros.py` (`/api/passageiros`), `routes/viagens.py` (`/api/viagens` + seat reservation endpoints).

All data is scoped to `current_user.id` — no cross-user data access.

### Auth Flow

1. `POST /api/auth/login` → returns JWT access token in body + refresh token in HttpOnly cookie.
2. On 401, `frontend/src/services/api.js` transparently calls `POST /api/auth/refresh` (using the cookie) and retries. Deduplication via a `refreshInFlight` promise to avoid parallel refresh races.
3. Access token stored in `localStorage` under key `travel-seat-manager:token`.
4. Refresh sessions are tracked in the `RefreshSession` DB table; logout revokes the session and clears the cookie.

### Seat Reservation

`POST /api/viagens/{id}/assentos/reservar` uses `SELECT ... FOR UPDATE` to prevent double-booking under concurrent requests.

Seat-creating mutation endpoints use an `IdempotencyKey` table to prevent duplicate operations on client retry.

### Frontend (`frontend/src/`)

- **`context/AuthContext.jsx`** — Auth state (token, user, login/logout). Consumed by all pages.
- **`services/api.js`** — Fetch wrapper: injects `Authorization: Bearer`, handles 401 with auto-refresh, adds idempotency keys on mutating requests.
- **`App.jsx`** — Route tree: `/login`, `/viagens`, `/passageiros`, catch-all → `/viagens`.
- Pages: `TripsPage.jsx` (trips + seat UI), `PassengersPage.jsx` (passenger list + form), `LoginPage.jsx`.

### Environment

`.env` at repo root is loaded by Docker Compose. Copy `.env.example` to get started. Key vars: `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`, `SECRET_KEY`, `COOKIE_SECURE`, `ENABLE_DOCS`.

For production, set `ENABLE_DOCS=false` and `COOKIE_SECURE=true`. The CORS `allow_origins` list in `main.py` currently hardcodes dev machine IPs — these should be moved to `.env` before deploying to a shared environment.
