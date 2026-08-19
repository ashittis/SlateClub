"""Film detail, status, and the logging loop.

These hit live TMDB for resolution (that is the point — resolution is where the
film row gets created), so they skip cleanly when no key is configured rather
than failing the suite on a machine without one.

`test_rewatch_preserves_history` is the one that matters most: rewatch being
first-class is a product requirement (KASET.md §8), and the failure mode —
a second log overwriting the first — would look like success to every other test.
"""

import pytest

from app.core.config import settings

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not settings.TMDB_API_KEY, reason="needs TMDB_API_KEY"),
]

INTERSTELLAR = 157336


async def test_film_detail_resolves_and_caches(signed_in):
    client, _ = signed_in
    resp = await client.get(f"/api/films/{INTERSTELLAR}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "Interstellar"
    assert body["year"] == "2014"
    assert any(d["name"] == "Christopher Nolan" for d in body["directors"])
    assert len(body["cast"]) > 0
    # No mediaType anywhere — Kaset is films only.
    assert "mediaType" not in body


async def test_unknown_film_is_404_not_500(signed_in):
    client, _ = signed_in
    assert (await client.get("/api/films/999999999")).status_code == 404


async def test_status_starts_empty(signed_in):
    client, _ = signed_in
    body = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()
    assert body["inWatchlist"] is False
    assert body["rating"] is None
    assert body["logCount"] == 0
    assert body["seen"] is False


async def test_watchlist_and_rating_round_trip(signed_in):
    client, _ = signed_in

    assert (await client.post(
        f"/api/films/{INTERSTELLAR}/watchlist", json={"note": "for the weekend"}
    )).status_code == 200
    body = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()
    assert body["inWatchlist"] is True
    assert body["watchlistNote"] == "for the weekend"

    assert (await client.post(
        f"/api/films/{INTERSTELLAR}/rate", json={"rating": 4.5}
    )).status_code == 200
    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["rating"] == 4.5

    # 0 clears the rating rather than storing a zero.
    await client.post(f"/api/films/{INTERSTELLAR}/rate", json={"rating": 0})
    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["rating"] is None

    await client.delete(f"/api/films/{INTERSTELLAR}/watchlist")
    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["inWatchlist"] is False


async def test_rating_alone_does_not_create_a_viewing(signed_in):
    """Rating is an opinion; logging is an event. Rating must never fabricate
    a diary entry — that would put films in the diary the user never watched."""
    client, _ = signed_in
    assert (await client.post(
        f"/api/films/{INTERSTELLAR}/rate", json={"rating": 5}
    )).status_code == 200
    status = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()
    assert status["rating"] == 5
    assert status["logCount"] == 0
    assert status["seen"] is False


async def test_rewatch_preserves_history(signed_in):
    """The Interstellar case from the spec: logged in 2024, logged again in
    2026. Both viewings survive; the second is flagged a rewatch."""
    client, _ = signed_in
    film_id = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["filmId"]

    first = await client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2024-03-01", "rating": 5,
    })
    assert first.status_code == 200, first.text
    assert first.json()["isRewatch"] is False

    second = await client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-01-15", "rating": 5,
    })
    assert second.status_code == 200, second.text
    # Defaults to a rewatch because a viewing already existed.
    assert second.json()["isRewatch"] is True

    viewings = (await client.get(f"/api/films/{INTERSTELLAR}/viewings")).json()["viewings"]
    assert len(viewings) == 2, "the earlier viewing must not be overwritten"
    assert viewings[0]["watchedOn"][:4] == "2026"
    assert viewings[1]["watchedOn"][:4] == "2024"

    status = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()
    assert status["logCount"] == 2
    assert status["seen"] is True


async def test_logging_removes_film_from_watchlist(signed_in):
    """Watching is terminal for the watchlist — a film you've seen shouldn't
    still be sitting in "to watch"."""
    client, _ = signed_in
    film_id = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["filmId"]

    await client.post(f"/api/films/{INTERSTELLAR}/watchlist")
    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["inWatchlist"] is True

    await client.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-02-02"})
    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["inWatchlist"] is False


async def test_deleting_last_viewing_clears_seen(signed_in):
    client, _ = signed_in
    film_id = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["filmId"]

    entry = (await client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-04-04",
    })).json()
    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["seen"] is True

    await client.delete(f"/api/diary/{entry['entryId']}")
    status = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()
    assert status["logCount"] == 0
    assert status["seen"] is False


async def test_film_search_returns_results(signed_in):
    client, _ = signed_in
    results = (await client.get("/api/films/search?q=interstellar")).json()["results"]
    assert results
    assert any(r["title"] == "Interstellar" for r in results)


async def test_person_lookup_returns_filmography(signed_in):
    client, _ = signed_in
    resp = await client.get("/api/films/people/525")  # Christopher Nolan
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Christopher Nolan"
    assert len(body["films"]) > 5

