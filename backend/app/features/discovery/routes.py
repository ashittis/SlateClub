"""Discovery — "what should I watch after this?"

Two lenses over one evidence-backed pool (KASET.md §9).

The request path is **cache-only**: it ranks a pool the warmer already
collected. It never calls Reddit, Brave, or an LLM for collection, so a missing
API key or a rate-limited source degrades the answer rather than failing the
page.
"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.features.discovery import pipeline
from app.shared.models.actions import Rating, WatchHistory
from app.shared.models.movie import Movie
from app.shared.models.onboarding import FavoriteMovie, LanguageSelection
from app.shared.models.user import User
from app.shared.services.films import get_or_fetch_film

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


async def _seed_from(db: AsyncSession, tmdb_id: int) -> dict:
    film = await get_or_fetch_film(tmdb_id, db)
    return {
        "tmdbId": film.tmdb_id,
        "title": film.title,
        "year": (film.release_date or "")[:4] or None,
        "genres": [g.get("name") for g in (film.genres or []) if g.get("name")],
        "original_language": film.original_language,
    }


async def _taste_of(db: AsyncSession, user: User) -> dict:
    """The user's explicit signals — nothing inferred, nothing learned.

    Favourite films, chosen languages, and the genres of films they rated well.
    If we can't name why something matched, we don't claim a match.
    """
    languages = (
        await db.execute(
            select(LanguageSelection.language).where(LanguageSelection.user_id == user.id)
        )
    ).scalars().all()

    liked_ids = (
        await db.execute(
            select(Rating.movie_id).where(Rating.user_id == user.id, Rating.value >= 4)
        )
    ).scalars().all()

    genres: set[str] = set()
    if liked_ids:
        for m in (
            await db.execute(select(Movie).where(Movie.id.in_(liked_ids)))
        ).scalars().all():
            for g in m.genres or []:
                if g.get("name"):
                    genres.add(g["name"])

    favourites = (
        await db.execute(
            select(FavoriteMovie.title).where(FavoriteMovie.user_id == user.id)
        )
    ).scalars().all()

    return {
        "languages": list(languages),
        "genres": sorted(genres),
        "favouriteFilms": list(favourites),
    }


@router.get("/similar/{tmdb_id}")
async def similar(
    tmdb_id: int,
    lens: str = Query("community", pattern="^(community|for_you)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Five films to watch after this one, with the evidence behind each.

    `lens=community` — what people recommend after this film.
    `lens=for_you`   — what is most likely to work for this viewer.

    Both rank the same pool; only the ranking layer differs.
    """
    seed = await _seed_from(db, tmdb_id)
    candidates = await pipeline.candidates_from_evidence(db, tmdb_id)

    if not candidates:
        # Honest empty rather than a fabricated list. The warmer hasn't reached
        # this film yet, or no source had anything to say about it.
        return {"seed": seed, "lens": lens, "results": [], "warm": False}

    watched: set[int] = set()
    rated: set[int] = set()
    taste: dict = {}

    if lens == "for_you":
        taste = await _taste_of(db, user)
        seen_rows = (
            await db.execute(
                select(Movie.tmdb_id)
                .join(WatchHistory, WatchHistory.movie_id == Movie.id)
                .where(WatchHistory.user_id == user.id)
            )
        ).scalars().all()
        watched = set(seen_rows)
        rated_rows = (
            await db.execute(
                select(Movie.tmdb_id)
                .join(Rating, Rating.movie_id == Movie.id)
                .where(Rating.user_id == user.id)
            )
        ).scalars().all()
        rated = set(rated_rows)

    results = await pipeline.recommend(
        db,
        seed,
        candidates,
        lens=lens,
        watched_tmdb_ids=watched,
        rated_tmdb_ids=rated,
        taste=taste,
    )
    return {"seed": seed, "lens": lens, "results": results, "warm": True}


@router.get("/evidence/{tmdb_id}")
async def evidence(
    tmdb_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The raw evidence trail for a seed — what was collected and from where.

    Exposed because a recommendation nobody can audit is just an assertion.
    """
    candidates = await pipeline.candidates_from_evidence(db, tmdb_id)
    return {
        "seedTmdbId": tmdb_id,
        "candidates": len(candidates),
        "mentions": sum(c.mention_count for c in candidates),
        "sources": sorted({
            m.get("source_name") for c in candidates for m in c.mentions if m.get("source_name")
        }),
    }
