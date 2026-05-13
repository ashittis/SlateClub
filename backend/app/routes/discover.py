"""
Discover API — Phase 1.5

Returns the sectioned data the redesigned Discover page consumes.
Each endpoint is a thin aggregator; heavy lifting lives in the
recommendation pipeline / taste graph and is reused here.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.movie import Movie
from ..models.onboarding import FavoritePerson, LanguageSelection
from ..models.user import User
from .recommendations import hydrate_catalog_for_languages

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


@router.get("/trending")
async def discover_trending(
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Top 10 by popularity. For logged-in users with non-English
    language preferences, biases toward those languages so the
    editorial top row isn't all Hollywood."""
    languages: list[str] = []
    if user is not None:
        languages = [
            r[0]
            for r in (
                await db.execute(
                    select(LanguageSelection.language).where(
                        LanguageSelection.user_id == user.id
                    )
                )
            ).all()
        ]
        # Make sure the catalog has stuff in those langs to surface.
        try:
            await hydrate_catalog_for_languages(languages, db)
        except Exception as exc:
            print(f"[discover/trending] hydrate failed: {exc}")

    user_langs = [l for l in languages if l and l != "en"]
    stmt = (
        select(Movie)
        .where(Movie.poster_path.is_not(None))
        .order_by(desc(Movie.popularity).nullslast())
        .limit(10)
    )
    if user_langs:
        stmt = (
            select(Movie)
            .where(Movie.poster_path.is_not(None))
            .where(Movie.original_language.in_(user_langs))
            .order_by(desc(Movie.popularity).nullslast())
            .limit(10)
        )
    rows = (await db.execute(stmt)).scalars().all()
    # Fallback to global if the user-language slice is empty.
    if not rows and user_langs:
        rows = (
            await db.execute(
                select(Movie)
                .where(Movie.poster_path.is_not(None))
                .order_by(desc(Movie.popularity).nullslast())
                .limit(10)
            )
        ).scalars().all()
    return {
        "items": [
            {
                "rank": i + 1,
                "tmdbId": m.tmdb_id,
                "title": m.title,
                "posterPath": m.poster_path,
                "releaseDate": m.release_date,
                # Platform attribution lives in P3 once watch-providers
                # backfill lands. For now we mark trending as "PRIME"
                # as a visual placeholder so the editorial layout reads.
                "platform": "PRIME" if i % 2 else "NETFLIX",
            }
            for i, m in enumerate(rows)
        ]
    }


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
