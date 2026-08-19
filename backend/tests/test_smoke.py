"""End-to-end smoke tests for Kaset's core loop.

These exist because Phase 1 shipped a bug that both `tsc` and `next build`
passed clean: a model column was dropped while a route still wrote it, so every
film page 500'd. Nothing but an actual request could have caught it.

Kept deliberately few and deliberately real — they exercise HTTP → route →
service → Postgres, with no mocks in between.
"""

import pytest

pytestmark = pytest.mark.asyncio


# ── Auth ─────────────────────────────────────────────────────────────────────

async def test_signup_sets_session_cookie(client):
    resp = await client.post(
        "/api/auth/signup",
        json={
            "email": "new@example.com",
            "password": "testpass123",
            "name": "New User",
            "username": "newuser",
        },
    )
    assert resp.status_code in (200, 201), resp.text
    assert resp.json()["username"] == "newuser"
    # The session must ride in a cookie, not a body token.
    assert any("token" in c.lower() for c in client.cookies.keys()), client.cookies


async def test_me_requires_auth(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_signed_in_user_can_read_own_profile(signed_in):
    client, user = signed_in
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["id"] == user["id"]
    # A fresh account has not completed onboarding.
    assert resp.json()["onboarded"] is False


async def test_duplicate_username_is_rejected(signed_in):
    client, _ = signed_in
    resp = await client.post(
        "/api/auth/signup",
        json={
            "email": "other@example.com",
            "password": "testpass123",
            "name": "Other",
            "username": "tester",
        },
    )
    assert resp.status_code >= 400


# ── Onboarding ───────────────────────────────────────────────────────────────

async def test_onboarding_persists_each_step(signed_in):
    client, _ = signed_in

    assert (await client.post(
        "/api/onboarding/languages", json={"languages": ["en", "ko", "ja"]}
    )).status_code == 200

    assert (await client.post("/api/onboarding/films", json={"films": [
        {"tmdbId": 157336, "title": "Interstellar", "posterPath": "/a.jpg"},
        {"tmdbId": 496243, "title": "Parasite", "posterPath": "/b.jpg"},
    ]})).status_code == 200

    assert (await client.post("/api/onboarding/people", json={"people": [
        {"tmdbId": 525, "name": "Christopher Nolan", "knownFor": "Directing"},
    ]})).status_code == 200

    assert (await client.post("/api/onboarding/preferences", json={
        "platforms": ["mubi"], "prefersTheatre": True, "preferredDecades": [1970],
    })).status_code == 200

    status = (await client.get("/api/onboarding/status")).json()
    assert status["languages"] == ["en", "ja", "ko"]
    # Order the user chose is preserved, not alphabetical or insertion-random.
    assert [f["title"] for f in status["films"]] == ["Interstellar", "Parasite"]
    assert status["people"][0]["name"] == "Christopher Nolan"
    assert status["preferences"]["prefersTheatre"] is True
    assert status["onboarded"] is False

    assert (await client.post("/api/onboarding/complete")).status_code == 200
    assert (await client.get("/api/onboarding/status")).json()["onboarded"] is True


async def test_onboarding_steps_are_idempotent(signed_in):
    """The client re-submits the whole set on every edit — resubmitting must
    replace, not accumulate."""
    client, _ = signed_in
    for _ in range(3):
        await client.post("/api/onboarding/languages", json={"languages": ["en", "fr"]})
    assert (await client.get("/api/onboarding/status")).json()["languages"] == ["en", "fr"]


async def test_onboarding_completable_with_only_languages(signed_in):
    """Every step after the first is optional. A user who skips films, people
    and preferences must still reach the app."""
    client, _ = signed_in
    await client.post("/api/onboarding/languages", json={"languages": ["en"]})
    assert (await client.post("/api/onboarding/complete")).status_code == 200

    status = (await client.get("/api/onboarding/status")).json()
    assert status["onboarded"] is True
    assert status["films"] == []
    assert status["people"] == []


async def test_favourite_films_are_capped(signed_in):
    client, _ = signed_in
    resp = await client.post("/api/onboarding/films", json={"films": [
        {"tmdbId": i, "title": f"Film {i}", "posterPath": None} for i in range(20)
    ]})
    assert resp.status_code == 422


async def test_onboarding_requires_auth(client):
    assert (await client.get("/api/onboarding/status")).status_code == 401


# ── Health ───────────────────────────────────────────────────────────────────

async def test_health_reports_integration_availability(client):
    body = (await client.get("/api/health")).json()
    assert body["status"] == "ok"
    assert body["app"] == "kaset"
    # Every integration is optional; the app must report, not require.
    assert set(body["integrations"]) == {"tmdb", "llm", "reddit", "websearch"}
