import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from threading import Barrier
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import get_token_hash, verify_password
from app.main import app
from app.models import Passageiro, PasswordResetToken, RefreshSession


def issue_token(db, user, *, expired=False, used=False):
    raw = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=get_token_hash(raw),
            expires_at=now + timedelta(minutes=-1 if expired else 30),
            used_at=now if used else None,
        )
    )
    db.commit()
    return raw


def reset(client, token, password="NewPassword2"):
    return client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": password}
    )


def test_forgot_response_does_not_enumerate_accounts(client, db, user):
    with patch("app.routes.auth.send_password_reset_email") as send:
        known = client.post("/api/auth/forgot-password", json={"email": user.email})
        unknown = client.post(
            "/api/auth/forgot-password", json={"email": "missing@example.com"}
        )
        user.is_active = False
        db.commit()
        inactive = client.post("/api/auth/forgot-password", json={"email": user.email})
    assert known.status_code == unknown.status_code == inactive.status_code == 200
    assert known.json() == unknown.json() == inactive.json()
    send.assert_called_once()
    raw_token = send.call_args.args[1]
    stored = db.query(PasswordResetToken).one()
    assert stored.token_hash == get_token_hash(raw_token)
    assert stored.token_hash != raw_token
    assert raw_token not in known.text
    assert known.headers["cache-control"] == "no-store"


def test_reset_revokes_access_refresh_and_other_reset_tokens(client, db, user):
    login = client.post(
        "/api/auth/login", json={"username": user.username, "password": "OldPassword1"}
    )
    assert login.status_code == 200
    access = login.json()["access_token"]
    refresh = client.cookies.get(settings.refresh_cookie_name)
    token = issue_token(db, user)
    other = issue_token(db, user)
    assert reset(client, token).status_code == 200
    db.refresh(user)
    assert user.token_version == 1
    assert verify_password("NewPassword2", user.password_hash)
    assert all(
        session.revoked_at is not None for session in db.query(RefreshSession).all()
    )
    assert reset(client, token).status_code == 400
    assert reset(client, other).status_code == 400
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {access}"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/refresh",
            headers={"Cookie": f"{settings.refresh_cookie_name}={refresh}"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"username": user.username, "password": "OldPassword1"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"username": user.username, "password": "NewPassword2"},
        ).status_code
        == 200
    )


@pytest.mark.parametrize("kind", ["expired", "used", "unknown", "inactive"])
def test_invalid_reset_cannot_change_password(client, db, user, kind):
    token = issue_token(db, user, expired=kind == "expired", used=kind == "used")
    if kind == "unknown":
        token = secrets.token_urlsafe(32)
    if kind == "inactive":
        user.is_active = False
        db.commit()
    assert reset(client, token).status_code == 400
    db.refresh(user)
    assert verify_password("OldPassword1", user.password_hash)
    assert user.token_version == 0


def test_weak_password_does_not_consume_token(client, db, user):
    token = issue_token(db, user)
    assert reset(client, token, "weakpass").status_code == 422
    assert reset(client, token).status_code == 200


@pytest.mark.parametrize("same_token", [True, False])
def test_concurrent_resets_have_exactly_one_winner(client, db, user, same_token):
    first = issue_token(db, user)
    second = first if same_token else issue_token(db, user)
    barrier = Barrier(2)

    def attempt(token):
        with TestClient(app) as concurrent_client:
            barrier.wait(timeout=10)
            return reset(concurrent_client, token).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(attempt, [first, second]))
    assert sorted(responses) == [200, 400]
    db.refresh(user)
    assert user.token_version == 1


def test_first_access_cannot_reset_existing_account(client, db, user):
    db.add(
        Passageiro(
            nome="Test Traveler",
            documento="123456789",
            data_nascimento=date(1990, 1, 1),
            telefone="123456789",
            contato_emergencia="Test Contact",
            criado_por_user_id=user.id,
            linked_user_id=user.id,
        )
    )
    db.commit()
    response = client.post(
        "/api/auth/setup",
        json={
            "documento": "123456789",
            "email": user.email,
            "new_password": "AttackPassword2",
        },
    )
    assert response.status_code == 401
    db.refresh(user)
    assert verify_password("OldPassword1", user.password_hash)


@pytest.mark.parametrize(
    "endpoint,payload",
    [
        ("forgot-password", {"email": "unknown@example.com"}),
        ("reset-password", {"token": "A" * 43, "new_password": "Password1"}),
        (
            "setup-admin",
            {
                "username": "admin",
                "email": "admin@example.com",
                "password": "Password1",
            },
        ),
    ],
)
def test_public_endpoints_are_rate_limited(client, user, db, endpoint, payload):
    user.is_admin = True
    db.commit()
    for _ in range(5):
        assert client.post(f"/api/auth/{endpoint}", json=payload).status_code != 429
    response = client.post(f"/api/auth/{endpoint}", json=payload)
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


@pytest.mark.parametrize("endpoint", ["refresh", "logout"])
def test_cookie_endpoints_require_allowed_origin_when_cross_site(
    client, monkeypatch, endpoint
):
    monkeypatch.setattr(settings, "cookie_samesite", "none")
    assert client.post(f"/api/auth/{endpoint}").status_code == 403
    assert (
        client.post(
            f"/api/auth/{endpoint}", headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/auth/{endpoint}", headers={"Origin": "http://localhost:5173"}
        ).status_code
        != 403
    )


def test_admin_password_change_revokes_recovery_and_refresh(client, db, user):
    user.is_admin = True
    db.commit()
    login = client.post(
        "/api/auth/login", json={"username": user.username, "password": "OldPassword1"}
    )
    token = issue_token(db, user)
    response = client.put(
        f"/api/users/{user.id}",
        json={"password": "AdminChanged2"},
        headers={
            "Authorization": f"Bearer {login.json()['access_token']}",
        },
    )
    assert response.status_code == 200
    assert reset(client, token).status_code == 400
    assert (
        db.query(RefreshSession).filter(RefreshSession.revoked_at.is_(None)).count()
        == 0
    )
