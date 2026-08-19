"""Passport sharing — monthly, yearly, and Wrapped.

These exist partly because this endpoint was silently broken: after the ML
removal it still read `movie.identity_json`, a column that no longer existed.
Nothing caught it, because nothing called it.

The recurring risk in stat code is a number that is *plausible but wrong* —
counting viewings as films, or a December window that quietly spills into
January. Those are what these test.
"""

import pytest

from app.core.config import settings

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not settings.TMDB_API_KEY, reason="needs TMDB_API_KEY"),
]

INTERSTELLAR = 157336
PARASITE = 496243


async def _film_id(client, tmdb_id: int = INTERSTELLAR) -> str:
    return (await client.get(f"/api/films/{tmdb_id}/status")).json()["filmId"]


async def test_wrapped_is_empty_for_a_blank_year(signed_in):
    me, _ = signed_in
    body = (await me.get("/api/wrapped/2019")).json()
    assert body["viewings"] == 0
    assert body["films"] == 0


async def test_wrapped_separates_films_from_viewings(signed_in):
    """Two viewings of one film is one film — collapsing them would inflate
    every recap that includes a rewatch."""
    me, _ = signed_in
    film_id = await _film_id(me)
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-01-05"})
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-06-05"})

    body = (await me.get("/api/wrapped/2026")).json()
    assert body["viewings"] == 2
    assert body["films"] == 1
    assert body["rewatches"] == 1
    assert body["mostRewatched"]["views"] == 2


async def test_wrapped_reports_the_real_headline_numbers(signed_in):
    me, _ = signed_in
    await me.post("/api/diary", json={
        "movieId": await _film_id(me), "watchedOn": "2026-02-01",
        "rating": 5, "watchType": "theatre",
    })
    await me.post("/api/diary", json={
        "movieId": await _film_id(me, PARASITE), "watchedOn": "2026-02-02", "rating": 4,
    })

    body = (await me.get("/api/wrapped/2026")).json()
    assert body["films"] == 2
    assert body["theatreVisits"] == 1
    assert body["averageRating"] == 4.5
    assert body["favouriteFilm"]["title"] == "Interstellar"
    assert body["topDirector"] is not None
    assert body["topActor"] is not None
    assert body["hours"] > 0


async def test_streak_counts_consecutive_days(signed_in):
    me, _ = signed_in
    film_id = await _film_id(me)
    for d in ("2026-03-01", "2026-03-02", "2026-03-03", "2026-03-09"):
        await me.post("/api/diary", json={"movieId": film_id, "watchedOn": d})

    assert (await me.get("/api/wrapped/2026")).json()["streak"] == 3


async def test_first_and_last_film_bookend_the_year(signed_in):
    me, _ = signed_in
    await me.post("/api/diary", json={
        "movieId": await _film_id(me), "watchedOn": "2026-01-02",
    })
    await me.post("/api/diary", json={
        "movieId": await _film_id(me, PARASITE), "watchedOn": "2026-07-30",
    })

    body = (await me.get("/api/wrapped/2026")).json()
    assert body["firstFilm"]["watchedOn"] == "2026-01-02"
    assert body["lastFilm"]["watchedOn"] == "2026-07-30"


async def test_years_lists_only_years_with_viewings(signed_in):
    me, _ = signed_in
    film_id = await _film_id(me)
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2024-05-05"})
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-05-05"})

    assert (await me.get("/api/wrapped/years")).json()["years"] == [2026, 2024]


# ── Share cards ──────────────────────────────────────────────────────────────

async def test_monthly_share_covers_exactly_its_month(signed_in):
    me, _ = signed_in
    film_id = await _film_id(me)
    for d in ("2026-04-30", "2026-05-01", "2026-05-31", "2026-06-01"):
        await me.post("/api/diary", json={"movieId": film_id, "watchedOn": d})

    may = (await me.get("/api/wrapped/share/month/2026/5")).json()
    assert may["viewings"] == 2, "April 30 and June 1 must not leak into May"
    assert may["label"] == "May 2026"


async def test_december_share_does_not_spill_into_january(signed_in):
    """The month window has to roll the year over — the classic off-by-one."""
    me, _ = signed_in
    film_id = await _film_id(me)
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2025-12-31"})
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-01-01"})

    dec = (await me.get("/api/wrapped/share/month/2025/12")).json()
    assert dec["viewings"] == 1
    assert dec["label"] == "December 2025"


async def test_share_cards_carry_who_they_belong_to(signed_in):
    """A card without its owner is unshareable — it could be anyone's year."""
    me, _ = signed_in
    await me.post("/api/diary", json={
        "movieId": await _film_id(me), "watchedOn": "2026-07-07", "rating": 5,
    })

    for path in ("/api/wrapped/share/year/2026", "/api/wrapped/share/month/2026/7"):
        card = (await me.get(path)).json()
        assert card["user"]["username"] == "tester"
        assert card["label"]


async def test_yearly_share_matches_wrapped(signed_in):
    """Both read the same computation — a card that disagreed with the story
    would be worse than having only one of them."""
    me, _ = signed_in
    film_id = await _film_id(me)
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-08-01", "rating": 4})
    await me.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-08-02"})

    card = (await me.get("/api/wrapped/share/year/2026")).json()
    story = (await me.get("/api/wrapped/2026")).json()
    for key in ("viewings", "films", "rewatches", "theatreVisits", "averageRating", "streak"):
        assert card[key] == story[key], f"{key} disagreed between card and story"


async def test_invalid_month_is_rejected(signed_in):
    me, _ = signed_in
    assert (await me.get("/api/wrapped/share/month/2026/13")).status_code == 422


async def test_wrapped_includes_private_viewings_for_the_owner(signed_in):
    """This is your own recap — a viewing you hid from others still happened."""
    me, _ = signed_in
    await me.post("/api/diary", json={
        "movieId": await _film_id(me), "watchedOn": "2026-06-09", "visibility": "private",
    })
    assert (await me.get("/api/wrapped/2026")).json()["viewings"] == 1
