"""
Artists API — Phase 3.1

Verified Artist Profiles + posts + AMAs + follow.
Filmography is fetched live from TMDB so we don't need to store
person_credits ourselves.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.features.artists.models import (
    AMA_STATUSES,
    ARTIST_POST_KINDS,
    AMA,
    AMAQuestion,
    Artist,
    ArtistFollow,
    ArtistPost,
)
from app.shared.models.user import User

router = APIRouter(prefix="/api/artists", tags=["artists"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ── Helpers ───────────────────────────────────────────────────


async def _get_or_create_artist(
    db: AsyncSession, tmdb_person_id: int
) -> Artist:
    """
    Lazily upserts an Artist row for the given TMDB person id.
    Names/headshots come from TMDB on first hit.
    """
    row = (
        await db.execute(
            select(Artist).where(Artist.tmdb_person_id == tmdb_person_id)
        )
    ).scalar_one_or_none()
    if row is not None:
        return row

    name = f"#{tmdb_person_id}"
    headshot: str | None = None
    roles: list[str] = []
    bio: str | None = None
    try:
        # Fetch person details for name, headshot, and biography.
        details = await tmdb.get_person_details(tmdb_person_id)
        if details.get("name"):
            name = details["name"]
        if details.get("profile_path"):
            headshot = details["profile_path"]
        if details.get("biography"):
            bio = details["biography"][:2000]
        dept = details.get("known_for_department", "Acting")
        if dept == "Directing":
            roles.append("Directing")
        elif dept == "Sound":
            roles.append("Music")
        elif dept == "Camera":
            roles.append("Cinematography")
        else:
            roles.append("Acting")
    except Exception:
        pass

    if not roles:
        try:
            credits = await tmdb.get_person_movie_credits(tmdb_person_id)
            cast = credits.get("cast", []) or []
            crew = credits.get("crew", []) or []
            if cast:
                roles.append("Acting")
            depts = {c.get("job") or c.get("department") for c in crew}
            if "Director" in depts or "Directing" in depts:
                if "Directing" not in roles:
                    roles.append("Directing")
        except Exception:
            pass

    row = Artist(
        tmdb_person_id=tmdb_person_id,
        name=name,
        headshot_url=headshot,
        roles=roles or ["Acting"],
        bio=bio,
    )
    db.add(row)
    await db.flush()
    return row


def _artist_payload(a: Artist, follower_count: int, is_following: bool) -> dict:
    return {
        "id": a.id,
        "tmdbPersonId": a.tmdb_person_id,
        "name": a.name,
        "headshotUrl": a.headshot_url,
        "roles": a.roles or [],
        "verified": a.verified,
        "bio": a.bio,
        "awards": a.awards or [],
        "followerCount": follower_count,
        "isFollowing": is_following,
    }


# ── Routes ────────────────────────────────────────────────────


@router.get("/search")
async def search_artists(
    q: str = Query(..., min_length=1),
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search people via TMDB, returning lightweight results for typeahead."""
    results = await tmdb.search_people(q)
    people = results.get("results", [])[:10]
    return {
        "results": [
            {
                "tmdbPersonId": p["id"],
                "name": p["name"],
                "profilePath": p.get("profile_path"),
                "knownFor": p.get("known_for_department", "Acting"),
            }
            for p in people
            if p.get("name")
        ]
    }


@router.get("/by-tmdb/{tmdb_person_id}")
async def get_artist_by_tmdb(
    tmdb_person_id: int,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    artist = await _get_or_create_artist(db, tmdb_person_id)

    follower_count = (
        await db.execute(
            select(func.count()).where(ArtistFollow.artist_id == artist.id)
        )
    ).scalar_one()

    is_following = False
    if user:
        is_following = (
            await db.execute(
                select(ArtistFollow).where(
                    ArtistFollow.artist_id == artist.id,
                    ArtistFollow.user_id == user.id,
                )
            )
        ).scalar_one_or_none() is not None

    # Filmography (live from TMDB)
    filmography: list[dict] = []
    try:
        credits = await tmdb.get_person_movie_credits(tmdb_person_id)
        cast = credits.get("cast", []) or []
        cast.sort(key=lambda c: c.get("popularity", 0), reverse=True)
        for c in cast[:24]:
            filmography.append(
                {
                    "tmdbId": c.get("id"),
                    "title": c.get("title"),
                    "posterPath": c.get("poster_path"),
                    "releaseDate": c.get("release_date"),
                    "character": c.get("character"),
                }
            )
    except Exception:
        pass

    return {
        **_artist_payload(artist, follower_count, is_following),
        "filmography": filmography,
    }


@router.post("/{artist_id}/follow")
async def follow_artist(
    artist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    artist = (
        await db.execute(select(Artist).where(Artist.id == artist_id))
    ).scalar_one_or_none()
    if artist is None:
        raise HTTPException(status_code=404)
    existing = (
        await db.execute(
            select(ArtistFollow).where(
                ArtistFollow.user_id == user.id,
                ArtistFollow.artist_id == artist.id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(ArtistFollow(user_id=user.id, artist_id=artist.id))
        await db.flush()
    return {"ok": True, "following": True}


@router.delete("/{artist_id}/follow")
async def unfollow_artist(
    artist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(ArtistFollow).where(
                ArtistFollow.user_id == user.id,
                ArtistFollow.artist_id == artist_id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True, "following": False}


# ── Posts ─────────────────────────────────────────────────────


class ArtistPostIn(CamelModel):
    kind: str
    body: str | None = None
    media_url: str | None = None
    linked_film_tmdb_id: int | None = None


@router.get("/{artist_id}/posts")
async def list_artist_posts(
    artist_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(ArtistPost)
            .where(ArtistPost.artist_id == artist_id)
            .order_by(desc(ArtistPost.created_at))
            .limit(limit)
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": p.id,
                "kind": p.kind,
                "body": p.body,
                "mediaUrl": p.media_url,
                "linkedFilmTmdbId": p.linked_film_tmdb_id,
                "createdAt": p.created_at.isoformat(),
            }
            for p in rows
        ]
    }


@router.post("/{artist_id}/posts")
async def create_artist_post(
    artist_id: str,
    body: ArtistPostIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    artist = (
        await db.execute(select(Artist).where(Artist.id == artist_id))
    ).scalar_one_or_none()
    if artist is None:
        raise HTTPException(status_code=404)
    if artist.claimed_by_user_id != user.id:
        raise HTTPException(
            status_code=403, detail="Only the verified artist can post"
        )
    if body.kind not in ARTIST_POST_KINDS:
        raise HTTPException(status_code=400, detail="invalid kind")

    post = ArtistPost(
        artist_id=artist.id,
        kind=body.kind,
        body=body.body,
        media_url=body.media_url,
        linked_film_tmdb_id=body.linked_film_tmdb_id,
    )
    db.add(post)
    await db.flush()
    return {
        "id": post.id,
        "kind": post.kind,
        "body": post.body,
        "mediaUrl": post.media_url,
        "linkedFilmTmdbId": post.linked_film_tmdb_id,
        "createdAt": post.created_at.isoformat(),
    }


# ── AMAs ──────────────────────────────────────────────────────


class AMAIn(CamelModel):
    title: str
    starts_at: datetime
    ends_at: datetime


@router.get("/{artist_id}/amas")
async def list_amas(
    artist_id: str,
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(AMA)
            .where(AMA.artist_id == artist_id)
            .order_by(desc(AMA.starts_at))
        )
    ).scalars().all()
    now = datetime.now(timezone.utc)
    items = []
    for a in rows:
        live = a.starts_at <= now <= a.ends_at
        ended = now > a.ends_at
        status = "live" if live else "ended" if ended else "scheduled"
        if status != a.status:
            a.status = status
        items.append(
            {
                "id": a.id,
                "title": a.title,
                "startsAt": a.starts_at.isoformat(),
                "endsAt": a.ends_at.isoformat(),
                "status": status,
            }
        )
    await db.flush()
    return {"items": items}


@router.post("/{artist_id}/amas")
async def create_ama(
    artist_id: str,
    body: AMAIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    artist = (
        await db.execute(select(Artist).where(Artist.id == artist_id))
    ).scalar_one_or_none()
    if artist is None:
        raise HTTPException(status_code=404)
    if artist.claimed_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the verified artist can schedule AMAs")
    ama = AMA(
        artist_id=artist.id,
        title=body.title,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
    )
    db.add(ama)
    await db.flush()
    return {"id": ama.id}


class AMAQuestionIn(BaseModel):
    question: str = Field(min_length=4, max_length=500)


@router.post("/amas/{ama_id}/questions")
async def ask_ama(
    ama_id: str,
    body: AMAQuestionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ama = (
        await db.execute(select(AMA).where(AMA.id == ama_id))
    ).scalar_one_or_none()
    if ama is None:
        raise HTTPException(status_code=404)
    q = AMAQuestion(ama_id=ama.id, user_id=user.id, question=body.question.strip())
    db.add(q)
    await db.flush()
    return {"id": q.id}


class AMAAnswerIn(BaseModel):
    answer: str = Field(min_length=1, max_length=2000)


@router.post("/ama-questions/{question_id}/answer")
async def answer_ama(
    question_id: str,
    body: AMAAnswerIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        await db.execute(select(AMAQuestion).where(AMAQuestion.id == question_id))
    ).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404)
    ama = (
        await db.execute(select(AMA).where(AMA.id == q.ama_id))
    ).scalar_one()
    artist = (
        await db.execute(select(Artist).where(Artist.id == ama.artist_id))
    ).scalar_one()
    if artist.claimed_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the artist can answer")
    q.answer_body = body.answer.strip()
    q.answered_at = datetime.now(timezone.utc)
    await db.flush()
    return {"ok": True}
