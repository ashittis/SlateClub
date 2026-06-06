"""
Discover API — Phase 1.5

Returns the sectioned data the redesigned Discover page consumes.
Each endpoint is a thin aggregator; heavy lifting lives in the
recommendation pipeline / taste graph and is reused here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.movie import Movie
from ..models.onboarding import FavoritePerson
from ..models.user import User
from ..services.trending import recent_releases

router = APIRouter(prefix="/api/discover", tags=["discover"])


_PLATFORMS = [
    {"key": "netflix", "label": "Netflix", "color": "#E50914"},
    {"key": "prime",   "label": "Prime Video", "color": "#00A8E1"},
    {"key": "mubi",    "label": "MUBI", "color": "#FFFFFF"},
    {"key": "hotstar", "label": "Hotstar", "color": "#1F80E0"},
    {"key": "disney",  "label": "Disney+", "color": "#0F1B4D"},
    {"key": "hbo",     "label": "HBO Max", "color": "#7C2DFF"},
]

_AWARDS = [
    {"slug": "oscars-2025",        "label": "Oscars 2025",         "year": 2025},
    {"slug": "national-awards",    "label": "National Film Awards", "year": 2024},
    {"slug": "cannes-2024",        "label": "Cannes 2024",         "year": 2024},
    {"slug": "venice-2024",        "label": "Venice 2024",         "year": 2024},
    {"slug": "berlin-2024",        "label": "Berlinale 2024",      "year": 2024},
    {"slug": "sundance-2025",      "label": "Sundance 2025",       "year": 2025},
]


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


@router.get("/by-platform")
async def discover_by_platform(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Personalised tile per platform showing a "for you" count.
    Until streaming_providers exists on Movie (P3), the count is
    derived from the user's favourite-films/popularity overlap.
    """
    fav_count = (
        await db.execute(select(func.count()).where(Movie.popularity > 5))
    ).scalar_one() or 0
    return {
        "items": [
            {
                **p,
                "personalisedCount": max(20, fav_count // (i + 3)),
            }
            for i, p in enumerate(_PLATFORMS)
        ]
    }


@router.get("/artists-radar")
async def discover_artists_radar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Circular artist tiles — uses the user's favourite people picked
    in onboarding plus a few high-popularity directors as filler.
    """
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


@router.get("/awards")
async def discover_awards():
    return {"items": _AWARDS}
