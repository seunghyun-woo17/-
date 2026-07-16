import os

# Must run before any app module is imported so the engine binds to in-memory
# SQLite instead of the default Postgres URL.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models import Base


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "postgres: test requires a real PostgreSQL backend (row locks / concurrency)",
    )


@pytest.fixture(autouse=True)
def create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
