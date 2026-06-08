"""
Letterboxd CSV import — Phase 4.5

Accepts the Letterboxd export ZIP/CSV files. The most useful ones:
  - ratings.csv     (Date, Name, Year, Letterboxd URI, Rating)
  - watched.csv     (Date, Name, Year, Letterboxd URI)
  - watchlist.csv   (Date, Name, Year, Letterboxd URI)

We resolve each row to a TMDB id via title + year, upsert the Movie,
then create the Rating / WatchHistory / WatchlistItem rows. Duplicates
are silently skipped. Returns per-file counts.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..integrations import tmdb
from ..models.actions import Rating, WatchHistory, WatchlistItem
from ..models.movie import Movie
from ..models.user import User

router = APIRouter(prefix="/api/import", tags=["import"])


async def _resolve_tmdb(title: str, year: str | None) -> dict | None:
    """Best-effort TMDB resolution. Returns the most popular match
    where the release year matches (if provided)."""
    try:
        res = await tmdb.search_movies(title)
    except Exception:
        return None
    results = res.get("results") or []
    if not results:
        return None
    if year:
        same_year = [
            r
            for r in results
            if (r.get("release_date") or "")[:4] == year
        ]
        if same_year:
            same_year.sort(key=lambda r: r.get("popularity", 0), reverse=True)
            return same_year[0]
    results.sort(key=lambda r: r.get("popularity", 0), reverse=True)
    return results[0]


async def _ensure_movie(db: AsyncSession, tmdb_data: dict) -> Movie:
    tmdb_id = tmdb_data.get("id")
    row = (
        await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    ).scalar_one_or_none()
    if row:
        return row
    row = Movie(
        tmdb_id=tmdb_id,
        title=tmdb_data.get("title") or "",
        overview=tmdb_data.get("overview"),
        poster_path=tmdb_data.get("poster_path"),
        backdrop_path=tmdb_data.get("backdrop_path"),
        release_date=tmdb_data.get("release_date"),
        vote_average=tmdb_data.get("vote_average"),
        vote_count=tmdb_data.get("vote_count"),
        popularity=tmdb_data.get("popularity"),
        original_language=tmdb_data.get("original_language"),
    )
    db.add(row)
    await db.flush()
    return row


def _parse_date(value: str) -> datetime:
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


@router.post("/letterboxd")
async def import_letterboxd(
    ratings: UploadFile | None = File(default=None),
    watched: UploadFile | None = File(default=None),
    watchlist: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Multipart upload — provide any combination of the three CSVs.
    Heavy: each row triggers a TMDB search. For large libraries (>500
    rows), expect a few seconds per 100 rows. Defer to a queue when
    user libraries get bigger.
    """
    if not (ratings or watched or watchlist):
        raise HTTPException(
            status_code=400, detail="Upload at least one CSV file"
        )

    counts = {
        "ratings": {"imported": 0, "skipped": 0, "unresolved": 0},
        "watched": {"imported": 0, "skipped": 0, "unresolved": 0},
        "watchlist": {"imported": 0, "skipped": 0, "unresolved": 0},
    }

    # ── ratings ──
    if ratings is not None:
        text = (await ratings.read()).decode("utf-8", errors="ignore")
        for row in csv.DictReader(io.StringIO(text)):
            title = (row.get("Name") or "").strip()
            year = (row.get("Year") or "").strip() or None
            rating_raw = (row.get("Rating") or "").strip()
            if not title or not rating_raw:
                counts["ratings"]["skipped"] += 1
                continue
            try:
                value = float(rating_raw)
            except ValueError:
                counts["ratings"]["skipped"] += 1
                continue
            # Snap to the 0.25 grid and clamp to the valid range so imported
            # data obeys the same quarter-star precision as in-app ratings.
            value = min(5.0, max(0.25, round(value * 4) / 4))

            tmdb_data = await _resolve_tmdb(title, year)
            if tmdb_data is None:
                counts["ratings"]["unresolved"] += 1
                continue
            movie = await _ensure_movie(db, tmdb_data)
            existing = (
                await db.execute(
                    select(Rating).where(
                        Rating.user_id == user.id,
                        Rating.movie_id == movie.id,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                counts["ratings"]["skipped"] += 1
                continue
            db.add(Rating(user_id=user.id, movie_id=movie.id, value=value))
            counts["ratings"]["imported"] += 1
        await db.flush()

    # ── watched ──
    if watched is not None:
        text = (await watched.read()).decode("utf-8", errors="ignore")
        for row in csv.DictReader(io.StringIO(text)):
            title = (row.get("Name") or "").strip()
            year = (row.get("Year") or "").strip() or None
            date_str = (row.get("Date") or "").strip()
            if not title:
                counts["watched"]["skipped"] += 1
                continue
            tmdb_data = await _resolve_tmdb(title, year)
            if tmdb_data is None:
                counts["watched"]["unresolved"] += 1
                continue
            movie = await _ensure_movie(db, tmdb_data)
            existing = (
                await db.execute(
                    select(WatchHistory).where(
                        WatchHistory.user_id == user.id,
                        WatchHistory.movie_id == movie.id,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                counts["watched"]["skipped"] += 1
                continue
            db.add(
                WatchHistory(
                    user_id=user.id,
                    movie_id=movie.id,
                    completion_pct=100.0,
                    watched_at=_parse_date(date_str) if date_str else datetime.now(timezone.utc),
                )
            )
            counts["watched"]["imported"] += 1
        await db.flush()

    # ── watchlist ──
    if watchlist is not None:
        text = (await watchlist.read()).decode("utf-8", errors="ignore")
        for row in csv.DictReader(io.StringIO(text)):
            title = (row.get("Name") or "").strip()
            year = (row.get("Year") or "").strip() or None
            if not title:
                counts["watchlist"]["skipped"] += 1
                continue
            tmdb_data = await _resolve_tmdb(title, year)
            if tmdb_data is None:
                counts["watchlist"]["unresolved"] += 1
                continue
            movie = await _ensure_movie(db, tmdb_data)
            existing = (
                await db.execute(
                    select(WatchlistItem).where(
                        WatchlistItem.user_id == user.id,
                        WatchlistItem.movie_id == movie.id,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                counts["watchlist"]["skipped"] += 1
                continue
            db.add(WatchlistItem(user_id=user.id, movie_id=movie.id))
            counts["watchlist"]["imported"] += 1
        await db.flush()

    total_imported = sum(c["imported"] for c in counts.values())
    return {
        "ok": True,
        "counts": counts,
        "totalImported": total_imported,
        "message": (
            f"Imported {total_imported} entries. The taste vector will "
            "refresh on your next /home load."
        ),
    }
