"""The Kaset Passport — identity, stats, and who can see what.

The tests that matter most here are the privacy ones. A private viewing that
leaks into someone else's view of your passport is a quiet, serious bug: nothing
errors, the number is just wrong, and the user never finds out.

Tests involving two people use the `other_client` fixture, which has its own
cookie jar. `signed_in` and `client` are the same session — signing a second
user up on `client` replaces the first rather than adding one.
"""

import pytest

from app.core.config import settings

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not settings.TMDB_API_KEY, reason="needs TMDB_API_KEY"),
]

INTERSTELLAR = 157336
PARASITE = 496243


async def _sign_up(session, username: str) -> dict:
    resp = await session.post("/api/auth/signup", json={
        "email": f"{username}@example.com",
        "password": "testpass123",
        "name": username.title(),
        "username": username,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


async def _film_id(session, tmdb_id: int = INTERSTELLAR) -> str:
    return (await session.get(f"/api/films/{tmdb_id}/status")).json()["filmId"]


# ── Shape ────────────────────────────────────────────────────────────────────

async def test_passport_is_the_same_shape_for_self_and_others(signed_in, other_client):
    """One payload shape means one component renders both views."""
    me, _ = signed_in
    mine = (await me.get("/api/passport/me")).json()
    assert mine["isOwner"] is True

    await _sign_up(other_client, "onlooker")
    theirs = (await other_client.get("/api/passport/tester")).json()
    assert theirs["isOwner"] is False
    assert set(mine) == set(theirs)


async def test_passport_carries_identity_and_totals(signed_in):
    me, _ = signed_in
    film_id = await _film_id(me)
    await me.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-01-10", "rating": 5,
        "watchType": "theatre", "review": "Worth the trip.",
    })

    p = (await me.get("/api/passport/me")).json()
    assert p["username"] == "tester"
    assert p["stats"]["films"] == 1
    assert p["stats"]["viewings"] == 1
    assert p["stats"]["theatreVisits"] == 1
    assert p["stats"]["averageRating"] == 5.0
    assert p["stats"]["reviews"] == 1
    assert p["years"] == [2026]


async def test_films_and_viewings_differ_on_rewatch(signed_in):
    """Conflating "films watched" with "times watched" is the easiest way to
    make a Wrapped card lie."""
    me, _ = signed_in
    film_id = await _film_id(me)
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2024-01-01"})
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-01-01"})

    stats = (await me.get("/api/passport/me")).json()["stats"]
    assert stats["films"] == 1
    assert stats["viewings"] == 2
    assert stats["rewatches"] == 1


# ── Privacy ──────────────────────────────────────────────────────────────────

async def test_private_viewings_count_for_owner_but_not_others(signed_in, other_client):
    me, _ = signed_in
    film_id = await _film_id(me)
    await me.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-01-10", "visibility": "private",
    })

    own = (await me.get("/api/passport/me")).json()["stats"]
    assert own["viewings"] == 1, "your own private viewings still count for you"

    await _sign_up(other_client, "nosy")
    seen = (await other_client.get("/api/passport/tester")).json()["stats"]
    assert seen["viewings"] == 0, "a private viewing must not leak into another view"


async def test_private_viewings_absent_from_public_diary(signed_in, other_client):
    me, _ = signed_in
    await me.post("/api/diary", json={
        "movieId": await _film_id(me), "visibility": "private",
    })
    await me.post("/api/diary", json={
        "movieId": await _film_id(me, PARASITE), "visibility": "public",
    })

    assert len((await me.get("/api/passport/tester/diary")).json()) == 2

    await _sign_up(other_client, "watcher")
    public = (await other_client.get("/api/passport/tester/diary")).json()
    assert len(public) == 1
    assert public[0]["title"] == "Parasite"


async def test_private_passport_is_refused(signed_in, other_client):
    me, _ = signed_in
    await me.patch("/api/users/me/preferences", json={"profile_visibility": "private"})

    await _sign_up(other_client, "stranger")
    assert (await other_client.get("/api/passport/tester")).status_code == 403


async def test_followers_only_passport_requires_a_follow(signed_in, other_client):
    me, owner = signed_in
    await me.patch("/api/users/me/preferences", json={"profile_visibility": "followers"})

    await _sign_up(other_client, "follower")
    assert (await other_client.get("/api/passport/tester")).status_code == 403

    follow = await other_client.post("/api/follows/", json={"user_id": owner["id"]})
    assert follow.status_code in (200, 201), follow.text
    assert (await other_client.get("/api/passport/tester")).status_code == 200


# ── Stats windows ────────────────────────────────────────────────────────────

async def test_stats_filter_by_year_and_month(signed_in):
    me, _ = signed_in
    film_id = await _film_id(me)
    for d in ("2024-03-01", "2026-01-15", "2026-02-20"):
        await me.post("/api/diary", json={"movieId": film_id, "watchedOn": d})

    assert (await me.get("/api/passport/tester/stats")).json()["viewings"] == 3
    assert (
        await me.get("/api/passport/tester/stats?period=year&year=2026")
    ).json()["viewings"] == 2
    assert (
        await me.get("/api/passport/tester/stats?period=month&year=2026&month=1")
    ).json()["viewings"] == 1


async def test_stats_surface_top_people(signed_in):
    me, _ = signed_in
    await me.post("/api/diary", json={
        "movieId": await _film_id(me), "watchedOn": "2026-01-01", "rating": 5,
    })

    stats = (await me.get("/api/passport/tester/stats")).json()
    assert "Christopher Nolan" in [d["name"] for d in stats["topPeople"]["directors"]]
    assert stats["topFilms"][0]["title"] == "Interstellar"


async def test_december_month_window_does_not_overflow_the_year(signed_in):
    """December's window has to roll into the next January — an off-by-one here
    silently drops or doubles the last month of every year."""
    me, _ = signed_in
    await me.post("/api/diary", json={
        "movieId": await _film_id(me), "watchedOn": "2025-12-31",
    })

    dec = (await me.get(
        "/api/passport/tester/stats?period=month&year=2025&month=12"
    )).json()
    assert dec["viewings"] == 1


# ── Editing ──────────────────────────────────────────────────────────────────

async def test_can_update_own_passport(signed_in):
    me, _ = signed_in
    updated = (await me.patch("/api/passport/me", json={
        "bio": "Mostly slow cinema.", "city": "Mumbai",
    })).json()
    assert updated["bio"] == "Mostly slow cinema."
    assert updated["city"] == "Mumbai"


async def test_username_collision_is_refused(signed_in, other_client):
    me, _ = signed_in
    await _sign_up(other_client, "taken")
    assert (await me.patch("/api/passport/me", json={"username": "taken"})).status_code == 409


async def test_unknown_passport_is_404(signed_in):
    me, _ = signed_in
    assert (await me.get("/api/passport/nobody")).status_code == 404
