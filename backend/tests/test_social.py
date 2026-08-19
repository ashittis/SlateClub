"""Following, activity, and direct messages.

The messaging tests exist because Kaset merged three systems into one. The thing
worth guarding is that a shared film is a *message* — it lands in the thread in
order and can be replied to — rather than a separate object in a separate inbox.
"""

import pytest

from app.core.config import settings

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not settings.TMDB_API_KEY, reason="needs TMDB_API_KEY"),
]

INTERSTELLAR = 157336


async def _sign_up(session, username: str) -> dict:
    resp = await session.post("/api/auth/signup", json={
        "email": f"{username}@example.com",
        "password": "testpass123",
        "name": username.title(),
        "username": username,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ── Following ────────────────────────────────────────────────────────────────

async def test_follow_and_unfollow(signed_in, other_client):
    me, owner = signed_in
    them = await _sign_up(other_client, "followee")

    assert (await me.post("/api/follows/", json={"user_id": them["id"]})).status_code in (200, 201)
    assert (await me.get(f"/api/follows/{them['id']}/check")).json()["following"] is True

    followers = (await me.get(f"/api/follows/{them['id']}/followers")).json()
    assert [f["username"] for f in followers] == ["tester"]

    await me.delete(f"/api/follows/{them['id']}")
    assert (await me.get(f"/api/follows/{them['id']}/check")).json()["following"] is False
    assert owner["username"] == "tester"


async def test_cannot_follow_yourself(signed_in):
    me, owner = signed_in
    assert (await me.post("/api/follows/", json={"user_id": owner["id"]})).status_code == 400


# ── Messages ─────────────────────────────────────────────────────────────────

async def test_sharing_a_film_is_a_message(signed_in, other_client):
    """The whole point of the merge: a shared film lives in the thread, not in
    a separate inbox, so it can be replied to."""
    me, _ = signed_in
    them = await _sign_up(other_client, "friend")

    sent = await me.post(f"/api/messages/with/{them['id']}", json={
        "tmdbId": INTERSTELLAR, "body": "You'd love this.",
    })
    assert sent.status_code == 200, sent.text
    payload = sent.json()
    assert payload["sharedFilm"]["title"] == "Interstellar"
    assert payload["body"] == "You'd love this."

    convo_id = payload["conversationId"]
    reply = await other_client.post(f"/api/messages/conversations/{convo_id}", json={
        "body": "Adding it now.",
    })
    assert reply.status_code == 200, reply.text

    thread = (await me.get(f"/api/messages/conversations/{convo_id}")).json()
    assert [m["body"] for m in thread["messages"]] == ["You'd love this.", "Adding it now."]
    assert thread["messages"][0]["sharedFilm"]["tmdbId"] == INTERSTELLAR
    assert thread["messages"][1]["sharedFilm"] is None


async def test_film_can_be_shared_without_words(signed_in, other_client):
    me, _ = signed_in
    them = await _sign_up(other_client, "quiet")

    sent = (await me.post(f"/api/messages/with/{them['id']}", json={
        "tmdbId": INTERSTELLAR,
    })).json()
    assert sent["body"] is None
    assert sent["sharedFilm"]["title"] == "Interstellar"

    inbox = (await other_client.get("/api/messages/conversations")).json()
    assert inbox[0]["lastPreview"] == "Shared Interstellar"


async def test_empty_message_is_rejected(signed_in, other_client):
    me, _ = signed_in
    them = await _sign_up(other_client, "nobody")
    assert (await me.post(f"/api/messages/with/{them['id']}", json={
        "body": "   ",
    })).status_code == 422


async def test_conversation_is_reused_not_duplicated(signed_in, other_client):
    """(A,B) and (B,A) must be the same thread — the old model left pair
    ordering to the caller and could create both."""
    me, owner = signed_in
    them = await _sign_up(other_client, "pair")

    first = (await me.post(f"/api/messages/with/{them['id']}", json={"body": "hi"})).json()
    second = (await other_client.post(f"/api/messages/with/{owner['id']}", json={
        "body": "hello back",
    })).json()

    assert first["conversationId"] == second["conversationId"]
    assert len((await me.get("/api/messages/conversations")).json()) == 1


async def test_unread_count_and_read_on_open(signed_in, other_client):
    me, owner = signed_in
    await _sign_up(other_client, "sender")

    await other_client.post(f"/api/messages/with/{owner['id']}", json={"body": "ping"})
    assert (await me.get("/api/messages/unread-count")).json()["count"] == 1

    convo_id = (await me.get("/api/messages/conversations")).json()[0]["id"]
    await me.get(f"/api/messages/conversations/{convo_id}")
    assert (await me.get("/api/messages/unread-count")).json()["count"] == 0


async def test_cannot_read_someone_elses_conversation(signed_in, other_client):
    me, owner = signed_in
    await _sign_up(other_client, "outsider")
    convo = (await other_client.post(f"/api/messages/with/{owner['id']}", json={
        "body": "private",
    })).json()

    # A third party must not be able to open it.
    await other_client.post("/api/auth/logout")
    await _sign_up(other_client, "thirdparty")
    resp = await other_client.get(f"/api/messages/conversations/{convo['conversationId']}")
    assert resp.status_code == 404
    assert me is not None


async def test_cannot_message_yourself(signed_in):
    me, owner = signed_in
    assert (await me.post(f"/api/messages/with/{owner['id']}", json={
        "body": "hi me",
    })).status_code == 400


# ── Activity ─────────────────────────────────────────────────────────────────

async def test_activity_feed_shows_people_you_follow(signed_in, other_client):
    me, _ = signed_in
    them = await _sign_up(other_client, "logger")

    film_id = (await other_client.get(f"/api/films/{INTERSTELLAR}/status")).json()["filmId"]
    await other_client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-01-10", "rating": 5,
    })

    empty = (await me.get("/api/activity/feed")).json()["events"]
    assert not any(e.get("userId") == them["id"] for e in empty), "not following yet"

    await me.post("/api/follows/", json={"user_id": them["id"]})
    feed = (await me.get("/api/activity/feed")).json()["events"]
    assert any(e.get("userId") == them["id"] for e in feed)


async def test_private_viewings_stay_out_of_activity(signed_in, other_client):
    me, _ = signed_in
    them = await _sign_up(other_client, "discreet")
    await me.post("/api/follows/", json={"user_id": them["id"]})

    film_id = (await other_client.get(f"/api/films/{INTERSTELLAR}/status")).json()["filmId"]
    await other_client.post("/api/diary", json={
        "movieId": film_id, "watchedOn": "2026-01-10", "visibility": "private",
    })

    feed = (await me.get("/api/activity/feed")).json()["events"]
    watched = [e for e in feed if e.get("type") in ("logged", "watched")]
    assert not watched, "a private viewing must never reach a follower's feed"
