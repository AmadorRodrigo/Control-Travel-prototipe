from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings, validate_settings
from app.core.email import send_password_reset_email
from app.core.maintenance import cleanup_expired_records
from app.core.rate_limit import InMemoryRateLimiter
from app.models import IdempotencyKey, PasswordResetToken, RefreshSession
from app.schemas import (
    AdminSetupRequest,
    FirstAccessRequest,
    LoginRequest,
    UserCreate,
    UserUpdate,
)


def test_rate_cleanup_preserves_each_buckets_window():
    limiter = InMemoryRateLimiter()
    with patch("app.core.rate_limit.monotonic", return_value=100):
        assert limiter.hit("short", 1, 60) == (True, 0)
        assert limiter.hit("long", 1, 120) == (True, 0)
    with patch("app.core.rate_limit.monotonic", return_value=160):
        assert limiter.cleanup() == 1
        assert limiter.hit("short", 1, 60) == (True, 0)
        assert limiter.hit("long", 1, 120)[0] is False
    with patch("app.core.rate_limit.monotonic", return_value=220):
        assert limiter.cleanup() == 2
        assert not limiter._requests
        assert not limiter._windows


def test_cleanup_removes_only_expired_rows(db, user):
    now = datetime.now(timezone.utc)
    for expired in (True, False):
        expiry = now + timedelta(days=-1 if expired else 1)
        db.add(
            PasswordResetToken(
                user_id=user.id, token_hash=str(expired), expires_at=expiry
            )
        )
        db.add(
            RefreshSession(
                user_id=user.id, jti=str(expired), token_hash="hash", expires_at=expiry
            )
        )
        db.add(
            IdempotencyKey(
                user_id=user.id,
                resource="test",
                key=str(expired),
                request_hash="hash",
                expires_at=expiry,
            )
        )
    db.commit()
    cleanup_expired_records()
    cleanup_expired_records()
    for model in (PasswordResetToken, RefreshSession, IdempotencyKey):
        assert db.query(model).count() == 1
        assert db.query(model).one().expires_at > now


@pytest.mark.parametrize(
    "password", ["Short1", "lowercase1", "UPPERCASE1", "NoDigitsHere", "A1" * 65]
)
def test_password_policy_all_writing_schemas(password):
    for model, payload in [
        (
            UserCreate,
            {"username": "test", "email": "test@example.com", "password": password},
        ),
        (
            AdminSetupRequest,
            {"username": "test", "email": "test@example.com", "password": password},
        ),
        (UserUpdate, {"password": password}),
        (
            FirstAccessRequest,
            {
                "documento": "123456",
                "email": "test@example.com",
                "new_password": password,
            },
        ),
    ]:
        with pytest.raises(ValidationError):
            model(**payload)


def test_login_still_accepts_legacy_passwords():
    assert LoginRequest(username="test", password="legacy").password == "legacy"
    assert UserUpdate(password=None).password is None
    assert UserCreate(username="test", email="test@example.com", password="Password1")


def test_cors_has_no_implicit_frontend_origin():
    config = Settings(
        _env_file=None, cors_origins="", frontend_url="http://localhost:5173"
    )
    assert config.cors_origins_list == []


def test_production_rejects_insecure_cookies(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "default_admin_password", "AnotherPassword1")
    monkeypatch.setattr(settings, "cookie_secure", False)
    with pytest.raises(RuntimeError, match="secure cookies"):
        validate_settings()


@pytest.mark.parametrize("use_ssl", [True, False])
def test_smtp_uses_tls_and_configured_reset_link(monkeypatch, use_ssl):
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_from", "sender@example.com")
    monkeypatch.setattr(settings, "smtp_user", "sender")
    monkeypatch.setattr(settings, "smtp_password", "test-only")
    monkeypatch.setattr(settings, "smtp_use_ssl", use_ssl)
    transport = "SMTP_SSL" if use_ssl else "SMTP"
    with patch(f"app.core.email.smtplib.{transport}") as smtp:
        send_password_reset_email("traveler@example.com", "test-token")
        connection = smtp.return_value.__enter__.return_value
        connection.login.assert_called_once_with("sender", "test-only")
        if use_ssl:
            connection.starttls.assert_not_called()
        else:
            connection.starttls.assert_called_once()
        message = connection.send_message.call_args.args[0]
        assert (
            f"{settings.reset_password_url}?token=test-token" in message.get_content()
        )


def test_smtp_failure_is_logged_without_secrets(monkeypatch, caplog):
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_from", "sender@example.com")
    with patch(
        "app.core.email.smtplib.SMTP",
        side_effect=OSError("private-address secret-token"),
    ):
        send_password_reset_email("private@example.com", "secret-token")
    assert "delivery failed" in caplog.text
    assert "secret-token" not in caplog.text
    assert "private@example.com" not in caplog.text


def test_api_security_headers(client):
    response = client.get("/api/auth/setup-status")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"


def test_allowed_cors_preflight(client):
    response = client.options(
        "/api/auth/reset-password",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
