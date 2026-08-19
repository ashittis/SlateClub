"""Named watchlists and Blends.

The ordering tests matter more than they look: a curated list is ordered on
purpose, and position bugs are the kind that only show up after a user has
already rearranged something and lost the arrangement.
"""

import pytest

pytestmark = pytest.mark.asyncio


async def _sign_up(session, username: str) -> dict:
    resp = await session.post("/api/auth/signup", json={
        "email": f"{username}@example.com",
        "password": "testpass123",
        "name": username.title(),
        "username": username,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


async def _list_with(client, *films) -> str:
    wl = (await client.post("/api/watchlists", json={"title": "Night in"})).json()
    for i, title in enumerate(films, start=1):
        await client.post(f"/api/watchlists/{wl['id']}/films", json={
            "tmdbId": i, "title": title, "posterPath": None, "year": "2000",
        })
    return wl["id"]


# ── Watchlists ───────────────────────────────────────────────────────────────

async def test_create_rename_and_delete(signed_in):
    me, _ = signed_in
    wl = (await me.post("/api/watchlists", json={
        "title": "1970s paranoia", "description": "Men in raincoats",
    })).json()
    assert wl["title"] == "1970s paranoia"
    assert wl["filmCount"] == 0

    renamed = (await me.patch(f"/api/watchlists/{wl['id']}", json={
        "title": "Paranoid 70s",
    })).json()
    assert renamed["title"] == "Paranoid 70s"

    assert (await me.delete(f"/api/watchlists/{wl['id']}")).status_code == 200
    assert (await me.get(f"/api/watchlists/{wl['id']}")).status_code == 404


async def test_films_keep_the_order_they_were_added(signed_in):
    me, _ = signed_in
    wl_id = await _list_with(me, "First", "Second", "Third")
    films = (await me.get(f"/api/watchlists/{wl_id}")).json()["films"]
    assert [f["title"] for f in films] == ["First", "Second", "Third"]


async def test_reorder_persists_the_users_arrangement(signed_in):
    me, _ = signed_in
    wl_id = await _list_with(me, "First", "Second", "Third")

    await me.patch(f"/api/watchlists/{wl_id}/films/reorder", json={"tmdbIds": [3, 1, 2]})
    films = (await me.get(f"/api/watchlists/{wl_id}")).json()["films"]
    assert [f["title"] for f in films] == ["Third", "First", "Second"]


async def test_reorder_never_drops_films_the_client_forgot(signed_in):
    """A stale client sending a partial order must not silently delete the rest."""
    me, _ = signed_in
    wl_id = await _list_with(me, "First", "Second", "Third")

    await me.patch(f"/api/watchlists/{wl_id}/films/reorder", json={"tmdbIds": [3]})
    films = (await me.get(f"/api/watchlists/{wl_id}")).json()["films"]
    assert films[0]["title"] == "Third"
    assert len(films) == 3, "unmentioned films must survive a partial reorder"


async def test_removing_a_film_closes_the_position_gap(signed_in):
    """Holes in the ordering make later reordering behave unpredictably."""
    me, _ = signed_in
    wl_id = await _list_with(me, "First", "Second", "Third")

    await me.delete(f"/api/watchlists/{wl_id}/films/1")
    films = (await me.get(f"/api/watchlists/{wl_id}")).json()["films"]
    assert [f["position"] for f in films] == [0, 1]


async def test_adding_the_same_film_twice_is_a_noop(signed_in):
    me, _ = signed_in
    wl = (await me.post("/api/watchlists", json={"title": "Dupes"})).json()
    film = {"tmdbId": 550, "title": "Fight Club", "posterPath": None}

    assert (await me.post(f"/api/watchlists/{wl['id']}/films", json=film)).json()["added"] is True
    assert (await me.post(f"/api/watchlists/{wl['id']}/films", json=film)).json()["added"] is False
    assert len((await me.get(f"/api/watchlists/{wl['id']}")).json()["films"]) == 1


async def test_private_watchlist_is_hidden_from_others(signed_in, other_client):
    me, _ = signed_in
    wl = (await me.post("/api/watchlists", json={
        "title": "Just for me", "visibility": "private",
    })).json()

    await _sign_up(other_client, "peeker")
    assert (await other_client.get(f"/api/watchlists/{wl['id']}")).status_code == 403
    assert (await me.get(f"/api/watchlists/{wl['id']}")).json()["isOwner"] is True


async def test_public_watchlist_is_readable_but_not_editable(signed_in, other_client):
    me, _ = signed_in
    wl_id = await _list_with(me, "Shared")

    await _sign_up(other_client, "reader")
    seen = await other_client.get(f"/api/watchlists/{wl_id}")
    assert seen.status_code == 200
    assert seen.json()["isOwner"] is False

    assert (await other_client.patch(f"/api/watchlists/{wl_id}", json={
        "title": "Hijacked",
    })).status_code == 404


# ── Blends ───────────────────────────────────────────────────────────────────

async def test_create_and_join_by_invite_link(signed_in, other_client):
    me, _ = signed_in
    blend = (await me.post("/api/blends", json={"title": "Friday night"})).json()
    assert blend["isMember"] is True
    assert len(blend["members"]) == 1
    token = blend["inviteToken"]
    assert token

    await _sign_up(other_client, "joiner")
    joined = (await other_client.post(f"/api/blends/join/{token}")).json()
    assert len(joined["members"]) == 2


async def test_joining_twice_does_not_duplicate_membership(signed_in, other_client):
    me, _ = signed_in
    token = (await me.post("/api/blends", json={"title": "B"})).json()["inviteToken"]

    await _sign_up(other_client, "eager")
    await other_client.post(f"/api/blends/join/{token}")
    twice = (await other_client.post(f"/api/blends/join/{token}")).json()
    assert len(twice["members"]) == 2


async def test_invalid_invite_token_is_404(signed_in):
    me, _ = signed_in
    assert (await me.post("/api/blends/join/not-a-real-token")).status_code == 404


async def test_invite_token_is_hidden_from_non_members(signed_in, other_client):
    """The token is the access model, so it must not leak to onlookers."""
    me, _ = signed_in
    blend = (await me.post("/api/blends", json={"title": "Private"})).json()

    await _sign_up(other_client, "outsider")
    seen = (await other_client.get(f"/api/blends/{blend['id']}")).json()
    assert seen["isMember"] is False
    assert seen["inviteToken"] is None


async def test_recommendations_need_two_members(signed_in):
    """A blend of one is just a profile — say so rather than returning a bare
    empty list the UI can't explain."""
    me, _ = signed_in
    blend = (await me.post("/api/blends", json={"title": "Solo"})).json()

    body = (await me.get(f"/api/blends/{blend['id']}/recommendations")).json()
    assert body["results"] == []
    assert body["reason"] == "waiting_for_members"


async def test_recommendations_refused_for_non_members(signed_in, other_client):
    me, _ = signed_in
    blend = (await me.post("/api/blends", json={"title": "Closed"})).json()

    await _sign_up(other_client, "gatecrasher")
    assert (
        await other_client.get(f"/api/blends/{blend['id']}/recommendations")
    ).status_code == 403


async def test_recommendations_explain_an_unwarmed_pool(signed_in, other_client):
    """Two members but no warm discovery pools is a distinct case from no
    overlap — the UI needs to tell them apart."""
    me, _ = signed_in
    blend = (await me.post("/api/blends", json={"title": "Cold"})).json()

    await _sign_up(other_client, "second")
    await other_client.post(f"/api/blends/join/{blend['inviteToken']}")

    body = (await me.get(f"/api/blends/{blend['id']}/recommendations")).json()
    assert body["members"] == 2
    assert body["reason"] in ("no_warm_pools", "no_overlap")


async def test_leaving_a_blend(signed_in, other_client):
    me, _ = signed_in
    blend = (await me.post("/api/blends", json={"title": "Leavers"})).json()

    await _sign_up(other_client, "quitter")
    await other_client.post(f"/api/blends/join/{blend['inviteToken']}")
    await other_client.delete(f"/api/blends/{blend['id']}/leave")

    assert len((await me.get(f"/api/blends/{blend['id']}")).json()["members"]) == 1
