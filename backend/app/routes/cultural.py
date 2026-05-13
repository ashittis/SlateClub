"""
Cultural intelligence — Phase 3.3

- Director Filmography Mode (chronological / best-to-worst)
- The Connector (path between two films via shared crew)
- Cultural Context Cards (per-film optional pre-watch card)
- Hidden Gem Alerts (low-vote, high-rated by twins)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..integrations import tmdb
from ..models.actions import Rating
from ..models.cultural import CulturalContext
from ..models.movie import Movie
from ..models.user import User

router = APIRouter(prefix="/api/cultural", tags=["cultural"])


# ── Director / Person Filmography Mode ───────────────────────


@router.get("/filmography/{tmdb_person_id}")
async def filmography(
    tmdb_person_id: int,
    order: str = Query("chronological", pattern="^(chronological|best_to_worst)$"),
    role: str = Query("director", pattern="^(director|acting|all)$"),
):
    """
    Returns a person's films sorted by date (oldest→newest) or by
    rating (best→worst). The artist profile uses popularity by default;
    this endpoint gives the explicit "watch the complete X" experience.
    """
    try:
        credits = await tmdb.get_person_movie_credits(tmdb_person_id)
    except Exception:
        raise HTTPException(status_code=502, detail="TMDB unreachable")

    items: list[dict] = []
    if role in ("director", "all"):
        for c in credits.get("crew", []) or []:
            if (c.get("job") or "").lower() == "director" or role == "all":
                items.append(_film_dict(c))
    if role in ("acting", "all"):
        for c in credits.get("cast", []) or []:
            items.append(_film_dict(c))

    # de-dup by tmdb id, preferring the most-popular entry
    by_id: dict[int, dict] = {}
    for it in items:
        tid = it.get("tmdbId")
        if tid is None:
            continue
        cur = by_id.get(tid)
        if cur is None or (it.get("popularity") or 0) > (cur.get("popularity") or 0):
            by_id[tid] = it
    deduped = list(by_id.values())

    if order == "chronological":
        deduped.sort(key=lambda f: (f.get("releaseDate") or "0000"))
    else:
        deduped.sort(
            key=lambda f: (f.get("voteAverage") or 0, f.get("popularity") or 0),
            reverse=True,
        )
    return {"items": deduped}


def _film_dict(c: dict) -> dict:
    return {
        "tmdbId": c.get("id"),
        "title": c.get("title"),
        "posterPath": c.get("poster_path"),
        "releaseDate": c.get("release_date"),
        "voteAverage": c.get("vote_average"),
        "popularity": c.get("popularity"),
        "role": c.get("character") or c.get("job"),
    }


# ── The Connector ─────────────────────────────────────────────


@router.get("/connector/{tmdb_id}")
async def connector(
    tmdb_id: int,
    limit: int = Query(8, ge=1, le=20),
):
    """
    "You loved X. The director also made Y. The cinematographer also
    shot Z." Returns up to `limit` connection threads via shared crew.
    """
    try:
        details = await tmdb.get_movie(tmdb_id)
    except Exception:
        raise HTTPException(status_code=502, detail="TMDB unreachable")

    crew = (details.get("credits", {}) or {}).get("crew", []) or []
    seen: set[int] = set()
    threads: list[dict] = []
    important_jobs = {"Director", "Director of Photography", "Original Music Composer", "Writer"}

    for c in crew:
        job = c.get("job")
        if job not in important_jobs:
            continue
        person_id = c.get("id")
        if not person_id:
            continue
        try:
            their_credits = await tmdb.get_person_movie_credits(person_id)
        except Exception:
            continue

        # Find their most-popular other film.
        other = sorted(
            [
                f for f in (their_credits.get("crew", []) or [])
                if f.get("id") and f["id"] != tmdb_id
            ],
            key=lambda f: f.get("popularity", 0),
            reverse=True,
        )
        if not other:
            continue
        top = other[0]
        if top["id"] in seen:
            continue
        seen.add(top["id"])
        threads.append(
            {
                "viaPerson": {"id": person_id, "name": c.get("name"), "role": job},
                "film": {
                    "tmdbId": top["id"],
                    "title": top.get("title"),
                    "posterPath": top.get("poster_path"),
                    "releaseDate": top.get("release_date"),
                },
            }
        )
        if len(threads) >= limit:
            break

    return {"items": threads}


# ── Cultural Context Cards ───────────────────────────────────


class CulturalContextIn(BaseModel):
    headline: str
    body: str
    source: str | None = None


@router.get("/context/{tmdb_id}")
async def get_context(
    tmdb_id: int,
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(CulturalContext).where(CulturalContext.tmdb_id == tmdb_id)
        )
    ).scalar_one_or_none()
    if row is None:
        return {"context": None}
    return {
        "context": {
            "headline": row.headline,
            "body": row.body,
            "source": row.source,
        }
    }


@router.post("/context/{tmdb_id}")
async def upsert_context(
    tmdb_id: int,
    body: CulturalContextIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # No editorial-role gating yet; tighten in admin work.
    row = (
        await db.execute(
            select(CulturalContext).where(CulturalContext.tmdb_id == tmdb_id)
        )
    ).scalar_one_or_none()
    if row is None:
        row = CulturalContext(
            tmdb_id=tmdb_id,
            headline=body.headline.strip(),
            body=body.body.strip(),
            source=body.source,
        )
        db.add(row)
    else:
        row.headline = body.headline.strip()
        row.body = body.body.strip()
        row.source = body.source
    await db.flush()
    return {"ok": True}


# ── Hidden Gem Alerts ────────────────────────────────────────


@router.get("/hidden-gems")
async def hidden_gems(
    limit: int = Query(12, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Films that:
      - have at least 3 high (≥4.0) ratings in the local DB,
      - and have under 500 global TMDB ratings,
    excluding ones the requesting user has already logged.
    """
    high_counts = (
        select(
            Rating.movie_id,
            func.count().label("cnt"),
        )
        .where(Rating.value >= 4.0)
        .group_by(Rating.movie_id)
        .having(func.count() >= 3)
        .subquery()
    )

    user_seen = {
        r[0]
        for r in (
            await db.execute(
                select(Rating.movie_id).where(Rating.user_id == user.id)
            )
        ).all()
    }

    rows = (
        await db.execute(
            select(Movie, high_counts.c.cnt)
            .join(high_counts, high_counts.c.movie_id == Movie.id)
            .where(Movie.vote_count.is_not(None))
            .where(Movie.vote_count < 500)
            .order_by(desc(high_counts.c.cnt))
            .limit(limit * 2)
        )
    ).all()

    items = [
        {
            "tmdbId": m.tmdb_id,
            "title": m.title,
            "posterPath": m.poster_path,
            "twinHighRatings": int(c),
            "globalVoteCount": m.vote_count,
            "voteAverage": m.vote_average,
        }
        for m, c in rows
        if m.id not in user_seen
    ][:limit]
    return {"items": items}
