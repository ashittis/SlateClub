"""
Trending = recent releases via TMDB, across the five industries.

Two editorial lists for the Discover page:
  * theatrical — films with a recent theatrical release
  * ott        — films with a recent digital (streaming) release

Sourced from TMDB /discover/movie filtered by release type + a recency window +
original language (region-aware), merged and sorted newest-first. Results are
cached in-process (short TTL) and upserted so posters / `/film/{id}` resolve.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from ..integrations import tmdb

# (original_language, release-date region). Region matters because TMDB release
# dates/types are per-country: Hollywood via US, Indian industries via IN.
INDUSTRIES: list[tuple[str, str]] = [
    ("en", "US"),  # Hollywood
    ("hi", "IN"),  # Bollywood
    ("ta", "IN"),  # Kollywood
    ("te", "IN"),  # Tollywood
    ("ml", "IN"),  # Mollywood
]

THEATRICAL_TYPES = "2|3"  # limited + theatrical
DIGITAL_TYPES = "4"       # digital / OTT
WINDOW_DAYS = 75
PER_ROW = 12

_PLATFORM_LABEL = {"theatrical": "In Theatres", "ott": "Streaming"}

# Short in-process cache so page loads don't hammer TMDB.
_CACHE: dict[str, tuple[float, list[dict]]] = {}
_TTL_SECONDS = 3 * 60 * 60


async def recent_releases(
    db: AsyncSession, kind: Literal["theatrical", "ott"]
) -> list[dict]:
    cached = _CACHE.get(kind)
    if cached and (time.time() - cached[0]) < _TTL_SECONDS:
        return cached[1]

    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=WINDOW_DAYS)
    types = THEATRICAL_TYPES if kind == "theatrical" else DIGITAL_TYPES

    async def _for_industry(lang: str, region: str) -> list[dict]:
        try:
            resp = await tmdb.discover_movies(
                {
                    "with_original_language": lang,
                    "region": region,
                    "with_release_type": types,
                    "release_date.gte": start.isoformat(),
                    "release_date.lte": today.isoformat(),
                    "sort_by": "popularity.desc",
                    "vote_count.gte": 1,
                    "page": 1,
                }
            )
            return resp.get("results") or []
        except Exception as exc:  # noqa: BLE001 — best-effort per industry
            print(f"[trending] discover failed for {kind}/{lang}: {exc}")
            return []

    pools = await asyncio.gather(
        *(_for_industry(lang, region) for lang, region in INDUSTRIES)
    )

    merged: dict[int, dict] = {}
    for raw in (r for pool in pools for r in pool):
        tid = raw.get("id")
        if not tid or not raw.get("poster_path") or tid in merged:
            continue
        merged[tid] = raw

    await _cache_movies(db, merged.values())

    ordered = sorted(
        merged.values(),
        key=lambda r: (r.get("release_date") or "", r.get("popularity") or 0.0),
        reverse=True,
    )[:PER_ROW]

    items = [
        {
            "rank": i + 1,
            "tmdbId": r["id"],
            "title": r.get("title") or "",
            "posterPath": r.get("poster_path"),
            "releaseDate": r.get("release_date"),
            "platform": _PLATFORM_LABEL[kind],
        }
        for i, r in enumerate(ordered)
    ]

    _CACHE[kind] = (time.time(), items)
    return items


async def _cache_movies(db: AsyncSession, raws) -> None:
    """Upsert discover stubs so posters + /film/{id} resolve later."""
    from ..routes.movies import _upsert_movie

    added = False
    for raw in raws:
        try:
            raw["genres"] = [
                {"id": gid, "name": ""} for gid in (raw.get("genre_ids") or [])
            ]
            async with db.begin_nested():
                await _upsert_movie(db, raw)
            added = True
        except Exception as exc:  # noqa: BLE001
            print(f"[trending] upsert failed for {raw.get('id')}: {exc}")
    if added:
        try:
            await db.flush()
        except Exception as exc:  # noqa: BLE001
            print(f"[trending] flush failed: {exc}")
