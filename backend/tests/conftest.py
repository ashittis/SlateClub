"""Test fixtures.

Runs against a real PostgreSQL database (`kaset_test`), not SQLite. Kaset's
schema uses JSON columns, `ON DELETE CASCADE` and composite unique constraints
whose behaviour differs across engines — a test suite that passed on SQLite
would not tell us the real thing works.

The schema is built by running the actual Alembic chain, so a broken migration
fails the suite rather than hiding behind `create_all`.
"""

import asyncio
import os
import subprocess
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_DB = "kaset_test"


def _admin_url() -> str:
    from app.core.config import settings

    return settings.DATABASE_URL.rsplit("/", 1)[0]


def _test_url() -> str:
    return f"{_admin_url()}/{TEST_DB}"


def _psql(sql: str) -> None:
    """Run a statement against the `postgres` maintenance database."""
    dsn = _admin_url().replace("postgresql+asyncpg://", "postgresql://") + "/postgres"
    subprocess.run(
        ["psql", dsn, "-v", "ON_ERROR_STOP=0", "-Atc", sql],
        check=False,
        capture_output=True,
    )


@pytest.fixture(scope="session", autouse=True)
def test_database():
    """Create `kaset_test`, migrate it, and hand its URL to the app.

    DATABASE_URL is set before `app.core.config` is imported anywhere, so the
    app and Alembic both build their engines against the test database.
    """
    _psql(f'DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)')
    _psql(f"CREATE DATABASE {TEST_DB}")

    # Point everything at the test DB *before* app modules are imported.
    from app.core.config import settings

    original = settings.DATABASE_URL
    settings.DATABASE_URL = _test_url()
    os.environ["DATABASE_URL"] = _test_url()

    result = subprocess.run(
        [str(BACKEND_DIR / ".venv/bin/alembic"), "upgrade", "head"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        env={**os.environ, "DATABASE_URL": _test_url()},
    )
    if result.returncode != 0:
        raise RuntimeError(f"alembic upgrade failed:\n{result.stderr}")

    yield

    settings.DATABASE_URL = original
    _psql(f'DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)')


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client(test_database):
    """An HTTP client bound to the app, with `get_db` pointed at the test DB.

    Cookies persist across requests on the client, so the auth flow works the
    way it does in a browser — which is the point of testing it at all.
    """
    from app.core.database import get_db
    from app.main import app

    engine = create_async_engine(_test_url(), echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()

    # The TMDB client is a module-level singleton whose connection pool binds to
    # the event loop that created it. pytest-asyncio gives each test a fresh
    # loop, so a client carried over from a previous test fails on reuse — which
    # surfaced as intermittent 404s, since get_or_fetch_film turns any TMDB
    # exception into "not found". Production runs one loop for the process
    # lifetime and is unaffected; the reset belongs here, not in the client.
    from app.integrations import tmdb

    if tmdb._client is not None:
        await tmdb._client.aclose()
        tmdb._client = None

    # Deleting users cascades their whole footprint, which is all the isolation
    # a test needs. `movies` is deliberately left alone: it is catalog data, not
    # user state, and clearing it made every test re-resolve the same film from
    # TMDB — which rate-limited the suite into flaky 404s.
    async with engine.begin() as conn:
        from sqlalchemy import text

        await conn.execute(text("DELETE FROM users"))
    await engine.dispose()


@pytest_asyncio.fixture
async def other_client(client):
    """A genuinely separate browser session against the same app.

    `client` and `signed_in` share one cookie jar, so signing up a second user
    on `client` silently *replaces* the first — any test that needs two people
    interacting must use this instead. The app and DB are shared; only the
    cookies are independent.
    """
    from app.core.database import get_db
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    assert get_db  # keeps the override contract explicit for readers


@pytest_asyncio.fixture
async def signed_in(client):
    """A registered, signed-in user. Returns (client, user_dict)."""
    resp = await client.post(
        "/api/auth/signup",
        json={
            "email": "tester@example.com",
            "password": "testpass123",
            "name": "Test User",
            "username": "tester",
        },
    )
    assert resp.status_code in (200, 201), resp.text
    return client, resp.json()
