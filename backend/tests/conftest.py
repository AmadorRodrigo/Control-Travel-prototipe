import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.core.rate_limit import rate_limiter
from app.core.security import get_password_hash
from app.main import app
from app.models import User


@pytest.fixture(autouse=True)
def isolated_database():
    if engine.url.database != "control_travel_test":
        pytest.fail(
            "Tests require the isolated control_travel_test database (see compose.test.yml)"
        )
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))
    with rate_limiter._lock:
        rate_limiter._requests.clear()
        rate_limiter._windows.clear()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def user(db):
    account = User(
        username="traveler",
        email="traveler@example.com",
        password_hash=get_password_hash("OldPassword1"),
    )
    db.add(account)
    db.commit()
    return account
