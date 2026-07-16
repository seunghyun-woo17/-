import os

# Must run before any app module is imported so that the engine binds to an
# in-memory SQLite database instead of the default Postgres URL.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
