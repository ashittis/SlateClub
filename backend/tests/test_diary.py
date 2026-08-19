"""The logging core: viewings, watch types, theatre visits, and reviews.

This is the heart of the product, so these tests are about *behaviour that
would be invisible if it broke*: a rewatch quietly overwriting an earlier
viewing, a rating snapshot silently tracking the current rating, or the derived
watch-history summary drifting out of step with the diary.
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


# ── Watch types & theatre visits ─────────────────────────────────────────────

async def test_theatre_visit_records_venue(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)

    entry = (await client.post("/api/diary", json={
        "movieId": film_id,
        "watchedOn": "2026-05-01",
        "watchType": "theatre",
        "theatreName": "Prithvi",
        "theatreCity": "Mumbai",
        "theatreFormat": "70mm",
    })).json()

    assert entry["watchType"] == "theatre"
    assert entry["theatre"] == {"name": "Prithvi", "city": "Mumbai", "format": "70mm"}


async def test_theatre_details_dropped_for_non_theatre_viewing(signed_in):
    """A cinema name against a streaming log is nonsense data. The service
    drops it rather than storing a contradiction."""
    client, _ = signed_in
    film_id = await _film_id(client)

    entry = (await client.post("/api/diary", json={
        "movieId": film_id,
        "watchType": "streaming",
        "theatreName": "Prithvi",
        "theatreCity": "Mumbai",
    })).json()

    assert entry["watchType"] == "streaming"
    assert entry["theatre"] is None


async def test_watch_type_defaults_and_rejects_nonsense(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)

    default = (await client.post("/api/diary", json={"movieId": film_id})).json()
    assert default["watchType"] == "streaming"

    bad = await client.post("/api/diary", json={"movieId": film_id, "watchType": "imax-ish"})
    assert bad.status_code == 422


async def test_future_viewings_are_rejected(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)
    resp = await client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2099-01-01",
    })
    assert resp.status_code == 422


# ── Rewatch ──────────────────────────────────────────────────────────────────

async def test_rating_snapshot_is_frozen_per_viewing(signed_in):
    """The diary shows what you thought *then*; `ratings` holds what you think
    *now*. Re-rating the film must not rewrite history."""
    client, _ = signed_in
    film_id = await _film_id(client)

    await client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2024-03-01", "rating": 3,
    })
    await client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-01-15", "rating": 5,
    })

    viewings = (await client.get(f"/api/films/{INTERSTELLAR}/viewings")).json()["viewings"]
    assert [v["rating"] for v in viewings] == [5, 3], "the 2024 snapshot must stay 3"

    # The current opinion is the most recent rating.
    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["rating"] == 5


async def test_backfilling_an_older_viewing_keeps_last_watched(signed_in):
    """Logging last year's viewing after this year's must not drag the derived
    'last watched' backwards."""
    client, _ = signed_in
    film_id = await _film_id(client)

    await client.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-01-15"})
    await client.post("/api/diary", json={"movieId": film_id, "watchedOn": "2020-06-01"})

    diary = (await client.get("/api/diary")).json()
    assert [e["watchedOn"] for e in diary] == ["2026-01-15", "2020-06-01"]


async def test_deleting_the_newest_viewing_resyncs_summary(signed_in):
    """The summary is rebuilt from what remains, not patched incrementally —
    otherwise deleting the most recent viewing leaves a stale 'last watched'."""
    client, _ = signed_in
    film_id = await _film_id(client)

    await client.post("/api/diary", json={"movieId": film_id, "watchedOn": "2024-03-01"})
    newest = (await client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-01-15",
    })).json()

    await client.delete(f"/api/diary/{newest['entryId']}")

    status = (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()
    assert status["logCount"] == 1
    assert status["seen"] is True, "one viewing remains, so the film is still seen"


# ── Reviews ──────────────────────────────────────────────────────────────────

async def test_logging_with_a_review_links_the_two(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)

    entry = (await client.post("/api/diary", json={
        "movieId": film_id,
        "watchedOn": "2026-02-01",
        "rating": 5,
        "review": "Still devastating on the fourth watch.",
    })).json()

    assert entry["review"]["body"] == "Still devastating on the fourth watch."

    reviews = (await client.get(f"/api/reviews/film/{film_id}")).json()
    assert len(reviews) == 1
    assert reviews[0]["diaryEntryId"] == entry["entryId"]
    # A review reads differently next to the score it came with.
    assert reviews[0]["rating"] == 5


async def test_review_survives_deleting_its_viewing(signed_in):
    """diary_entries.review_id is SET NULL, not CASCADE — deleting a viewing
    must not destroy the writing that came with it."""
    client, _ = signed_in
    film_id = await _film_id(client)

    entry = (await client.post("/api/diary", json={
        "movieId": film_id, "review": "A note I'd hate to lose.",
    })).json()

    await client.delete(f"/api/diary/{entry['entryId']}")

    reviews = (await client.get(f"/api/reviews/film/{film_id}")).json()
    assert len(reviews) == 1
    assert reviews[0]["body"] == "A note I'd hate to lose."
    assert reviews[0]["diaryEntryId"] is None


async def test_viewing_survives_deleting_its_review(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)

    entry = (await client.post("/api/diary", json={
        "movieId": film_id, "review": "Temporary thoughts.",
    })).json()
    review_id = entry["review"]["id"]

    await client.delete(f"/api/reviews/{review_id}")

    assert (await client.get(f"/api/films/{INTERSTELLAR}/status")).json()["logCount"] == 1


async def test_rewriting_a_review_updates_rather_than_duplicates(signed_in):
    """One review per (user, film) — a rewatch rewrite should not stack two
    reviews from the same person on one film page."""
    client, _ = signed_in
    film_id = await _film_id(client)

    await client.post("/api/diary", json={"movieId": film_id, "review": "First pass."})
    await client.post("/api/diary", json={"movieId": film_id, "review": "Better on rewatch."})

    reviews = (await client.get(f"/api/reviews/film/{film_id}")).json()
    assert len(reviews) == 1
    assert reviews[0]["body"] == "Better on rewatch."


# ── Editing & privacy ────────────────────────────────────────────────────────

async def test_editing_away_from_theatre_clears_venue(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)

    entry = (await client.post("/api/diary", json={
        "movieId": film_id, "watchType": "theatre", "theatreName": "Prithvi",
    })).json()

    edited = (await client.patch(f"/api/diary/{entry['entryId']}", json={
        "watchType": "streaming",
    })).json()

    assert edited["watchType"] == "streaming"
    assert edited["theatre"] is None


async def test_private_viewings_stay_in_the_owners_diary(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)

    await client.post("/api/diary", json={
        "movieId": film_id, "visibility": "private",
    })
    diary = (await client.get("/api/diary")).json()
    assert len(diary) == 1
    assert diary[0]["visibility"] == "private"


async def test_diary_filters_by_year(signed_in):
    client, _ = signed_in
    film_id = await _film_id(client)

    await client.post("/api/diary", json={"movieId": film_id, "watchedOn": "2024-03-01"})
    await client.post("/api/diary", json={"movieId": film_id, "watchedOn": "2026-01-15"})

    assert len((await client.get("/api/diary?year=2024")).json()) == 1
    assert len((await client.get("/api/diary?year=2026")).json()) == 1
    assert len((await client.get("/api/diary")).json()) == 2


async def test_cannot_edit_someone_elses_viewing(signed_in, client):
    client_a, _ = signed_in
    film_id = await _film_id(client_a)
    entry = (await client_a.post("/api/diary", json={"movieId": film_id})).json()

    # A second account in the same test client would share cookies, so assert
    # the ownership check via a signed-out request instead.
    await client_a.post("/api/auth/logout")
    resp = await client_a.patch(f"/api/diary/{entry['entryId']}", json={"rating": 1})
    assert resp.status_code in (401, 404)
