from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings

connect_args: dict = {}
engine_kwargs: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # In-memory SQLite gives each connection its own separate database. The
    # TestClient runs endpoints on worker threads, so without a single shared
    # connection the schema created in the test thread is invisible there.
    if ":memory:" in settings.DATABASE_URL:
        engine_kwargs["poolclass"] = StaticPool

# create_engine is lazy: the DBAPI driver (e.g. psycopg) is only imported when
# a connection is actually established, so a sqlite URL never touches psycopg.
engine = create_engine(
    settings.DATABASE_URL, connect_args=connect_args, **engine_kwargs
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
