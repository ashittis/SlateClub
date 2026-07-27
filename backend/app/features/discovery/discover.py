"""
Discover API — the real, honest aggregators.

Only what has genuine data behind it:
  /trending       — recent theatrical + OTT releases from TMDB
  /artists-radar  — the user's onboarding favourites

(The old /by-platform returned a fabricated per-user count — identical for
everyone — and /awards was six hardcoded labels with no films. Both were
removed. Honest platform data needs Movie.streaming_providers + a TMDB
watch/providers wrapper; awards belong in /festivals.)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.onboarding import FavoritePerson
from app.shared.models.user import User
from app.shared.services.trending import recent_releases

router = APIRouter(prefix="/api/discover", tags=["discover"])


def _ranked(items: list[dict]) -> list[dict]:
    return [{**m, "rank": i + 1} for i, m in enumerate(items)]


@router.get("/trending")
async def discover_trending(db: AsyncSession = Depends(get_db)):
    """Two editorial lists of recent releases across the five industries
    (Hollywood/Bollywood/Kollywood/Tollywood/Mollywood), sourced from TMDB:
    recently in theatres, and recently landed on OTT."""
    theatrical = await recent_releases(db, "theatrical")
    ott = await recent_releases(db, "ott")
    # A film newly on OTT is the more relevant state — keep it out of theatrical.
    ott_ids = {m["tmdbId"] for m in ott}
    theatrical = [m for m in theatrical if m["tmdbId"] not in ott_ids]
    return {"theatrical": _ranked(theatrical), "ott": _ranked(ott)}


@router.get("/artists-radar")
async def discover_artists_radar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Circular artist tiles — the user's favourite people picked in onboarding."""
    rows = (
        await db.execute(
            select(FavoritePerson)
            .where(FavoritePerson.user_id == user.id)
            .limit(8)
        )
    ).scalars().all()
    items = [
        {
            "tmdbId": p.tmdb_id,
            "name": p.name,
            "role": p.known_for or "Acting",
            "profilePath": p.profile_path,
        }
        for p in rows
    ]
    return {"items": items}
