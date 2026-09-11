import os

os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["KAFKA_ENABLED"] = "false"
os.environ["APP_TIMEZONE"] = "UTC"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app


def csrf_headers_from_response(response) -> dict[str, str]:
    token = response.cookies.get("csrf_token")
    assert token
    return {"X-CSRF-Token": token}


def register_user(
    client: TestClient,
    email: str = "user@example.com",
    full_name: str = "Test User",
    password: str = "password1",
):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "full_name": full_name,
            "password": password,
        },
    )


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def auth_headers(client):
    response = register_user(client)
    assert response.status_code == 201
    return csrf_headers_from_response(response)
