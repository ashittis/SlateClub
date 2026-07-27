"""
Release calendar — upcoming theatrical releases via TMDB, across ALL languages.

Mirrors trending.py but for FUTURE dates: pulls films releasing in the next
~month, language-agnostic (a global pass + per-Indian-language passes incl
Kannada), groups them by release date, and caches. The frontend derives the
Upcoming/Biggies × Week/Month panel sets client-side from this one payload.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import tmdb

WINDOW_DAYS = 31
THEATRICAL_TYPES = "2|3"  # limited + theatrical

# A global pass (no language filter) catches Hollywood + worldwide; explicit
# Indian-language passes (incl Kannada) guarantee regional coverage.
PASSES: list[dict] = [
    {},  # global — all languages
    {"with_original_language": "hi", "region": "IN"},
    {"with_original_language": "ta", "region": "IN"},
    {"with_original_language": "te", "region": "IN"},
    {"with_original_language": "ml", "region": "IN"},
    {"with_original_language": "kn", "region": "IN"},
]

_CACHE: dict[str, tuple[float, dict]] = {}
_TTL_SECONDS = 3 * 60 * 60


async def upcoming_calendar(db: AsyncSession) -> dict:
    cached = _CACHE.get("calendar")
    if cached and (time.time() - cached[0]) < _TTL_SECONDS:
        return cached[1]

    today = datetime.now(timezone.utc).date()
    end = today + timedelta(days=WINDOW_DAYS)

    async def _pass(extra: dict) -> list[dict]:
        out: list[dict] = []
        for page in (1, 2):
            try:
                resp = await tmdb.discover_movies(
                    {
                        "primary_release_date.gte": today.isoformat(),
                        "primary_release_date.lte": end.isoformat(),
                        "with_release_type": THEATRICAL_TYPES,
                        "sort_by": "popularity.desc",
                        "page": page,
                        **extra,
                    }
                )
            except Exception as exc:  # noqa: BLE001 — best-effort per pass
                print(f"[releases] discover failed for {extra}: {exc}")
                break
            out.extend(resp.get("results") or [])
        return out

    pools = await asyncio.gather(*(_pass(p) for p in PASSES))

    merged: dict[int, dict] = {}
    for raw in (r for pool in pools for r in pool):
        tid = raw.get("id")
        rdate = raw.get("release_date") or ""
        if not tid or not raw.get("poster_path") or tid in merged:
            continue
        # Keep only films whose primary release date falls in the window.
        if not (today.isoformat() <= rdate <= end.isoformat()):
            continue
        merged[tid] = raw

    await _cache_movies(db, merged.values())

    by_date: dict[str, list[dict]] = defaultdict(list)
    for r in merged.values():
        by_date[r["release_date"]].append(
            {
                "tmdbId": r["id"],
                "title": r.get("title") or "",
                "posterPath": r.get("poster_path"),
                "backdropPath": r.get("backdrop_path"),
                "releaseDate": r.get("release_date"),
                "originalLanguage": r.get("original_language"),
                "voteAverage": r.get("vote_average"),
                "popularity": r.get("popularity") or 0.0,
            }
        )

    days = [
        {
            "date": date,
            "films": sorted(films, key=lambda f: f["popularity"], reverse=True),
        }
        for date, films in sorted(by_date.items())
    ]

    payload = {"days": days}
    _CACHE["calendar"] = (time.time(), payload)
    return payload


async def _cache_movies(db: AsyncSession, raws) -> None:
    """Upsert discover stubs so posters + /film/{id} resolve later."""
    from app.features.movies.movies import _upsert_movie

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
            print(f"[releases] upsert failed for {raw.get('id')}: {exc}")
    if added:
        try:
            await db.flush()
        except Exception as exc:  # noqa: BLE001
            print(f"[releases] flush failed: {exc}")
