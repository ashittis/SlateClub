"""
Letterboxd CSV import.

There is no Letterboxd API or OAuth — the CSV export is the sanctioned path.
The export ZIP's most useful files:
  - diary.csv     (Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date)
  - ratings.csv   (Date, Name, Year, Letterboxd URI, Rating)
  - watched.csv   (Date, Name, Year, Letterboxd URI)
  - watchlist.csv (Date, Name, Year, Letterboxd URI)

`diary.csv` is the real per-viewing file: each row becomes a dated `DiaryEntry`
(watch_log) using its **Watched Date** — which retroactively fills the Diary tab
and Wrapped for past years. `watched.csv` is a degraded fallback (one row/film,
no rewatches) used only for films absent from the diary. `ratings.csv` sets the
canonical rating; `watchlist.csv` the shelf.

Idempotent: re-uploading the same export is a no-op (dedupe on user+movie+date).
"""

from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.shared.models.actions import DiaryEntry, Rating, WatchlistItem
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.diary_service import summary_had_row, upsert_watch_summary

router = APIRouter(prefix="/api/import", tags=["import"])


# ── TMDB resolution (memoised + bounded-concurrency) ─────────────

async def _resolve_tmdb(title: str, year: str | None) -> dict | None:
    """Best-effort TMDB resolution — most-popular match, year-preferred."""
    try:
        res = await tmdb.search_movies(title)
    except Exception:  # noqa: BLE001
        return None
    results = res.get("results") or []
    if not results:
        return None
    if year:
        same_year = [r for r in results if (r.get("release_date") or "")[:4] == year]
        if same_year:
            same_year.sort(key=lambda r: r.get("popularity", 0), reverse=True)
            return same_year[0]
    results.sort(key=lambda r: r.get("popularity", 0), reverse=True)
    return results[0]


async def _resolve_all(
    pairs: set[tuple[str, str | None]],
) -> dict[tuple[str, str | None], dict | None]:
    """Resolve every unique (title, year) once, up to 5 TMDB calls at a time.
    Network-concurrent; callers then walk rows sequentially (the async session
    is not safe for concurrent writes). Bounded at 5 because tmdb.py has no 429
    handling — drop this if imports start 429ing."""
    sem = asyncio.Semaphore(5)

    async def _one(title: str, year: str | None):
        async with sem:
            return (title, year), await _resolve_tmdb(title, year)

    resolved = await asyncio.gather(*(_one(t, y) for t, y in pairs))
    return dict(resolved)


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


async def _cached_movie(
    db: AsyncSession, tmdb_data: dict, cache: dict[int, Movie]
) -> Movie:
    tid = tmdb_data.get("id")
    if tid in cache:
        return cache[tid]
    movie = await _ensure_movie(db, tmdb_data)
    cache[tid] = movie
    return movie


def _parse_date_or_none(value: str) -> datetime | None:
    """Parse a Letterboxd date, or None (never fabricate 'today' — that would
    silently land old viewings in the current year and corrupt Wrapped). Anchored
    at 12:00 UTC so a date can't straddle a year boundary under tz conversion."""
    value = (value or "").strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).replace(
                hour=12, minute=0, tzinfo=timezone.utc
            )
        except ValueError:
            continue
    return None


def _snap_rating(raw: str) -> float | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return min(5.0, max(0.25, round(float(raw) * 4) / 4))
    except ValueError:
        return None


def _rows(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text)))


# ── Viewing import (diary + watched) ─────────────────────────────

async def _set_rating_if_absent(
    db: AsyncSession, user_id: str, movie_id: str, value: float
) -> None:
    existing = (
        await db.execute(
            select(Rating).where(Rating.user_id == user_id, Rating.movie_id == movie_id)
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(Rating(user_id=user_id, movie_id=movie_id, value=value))


async def _import_viewings(
    db: AsyncSession,
    user: User,
    rows: list[dict],
    *,
    source: str,
    visibility: str,
    date_col: str,
    counts: dict,
    resolved: dict,
    movie_cache: dict[int, Movie],
    skip_movie_ids: set[str],
) -> set[str]:
    """Create dated DiaryEntry rows (+ WatchHistory summary + rating snapshot)
    from diary/watched rows. Groups by film so viewings order by date and
    rewatches infer correctly. Dedupe is importer-side on (user, movie, date) —
    DiaryEntry is intentionally non-unique, so same-day double-logging stays legal
    in-app; re-importing collapses same-day duplicates. Returns movie.ids touched."""
    # Group rows by resolved film.
    by_movie: dict[str, list[dict]] = {}
    movie_of: dict[str, Movie] = {}
    for row in rows:
        title = (row.get("Name") or "").strip()
        year = (row.get("Year") or "").strip() or None
        if not title:
            counts[source]["skipped"] += 1
            continue
        tmdb_data = resolved.get((title, year))
        if not tmdb_data:
            counts[source]["unresolved"] += 1
            continue
        movie = await _cached_movie(db, tmdb_data, movie_cache)
        if movie.id in skip_movie_ids:
            counts[source]["skipped"] += 1
            continue
        by_movie.setdefault(movie.id, []).append(row)
        movie_of[movie.id] = movie

    touched: set[str] = set()
    for movie_id, film_rows in by_movie.items():
        movie = movie_of[movie_id]
        # Snapshot BEFORE writing — a pre-existing summary means any imported
        # viewing is a rewatch.
        had_summary = await summary_had_row(db, user.id, movie.id)
        existing = (
            await db.execute(
                select(DiaryEntry.watched_at).where(
                    DiaryEntry.user_id == user.id, DiaryEntry.movie_id == movie.id
                )
            )
        ).scalars().all()
        existing_dates = {d.date() for d in existing if d}

        # Order by watched date ascending; undated rows sort last.
        dated = [(_parse_date_or_none(r.get(date_col) or ""), r) for r in film_rows]
        _floor = datetime.min.replace(tzinfo=timezone.utc)
        dated.sort(key=lambda e: (e[0] is None, e[0] or _floor))

        wrote_one = False
        for watched_at, row in dated:
            if watched_at is None:
                counts[source]["skipped"] += 1
                continue
            dkey = watched_at.date()
            if dkey in existing_dates:
                counts[source]["skipped"] += 1
                continue

            explicit_rewatch = (row.get("Rewatch") or "").strip().lower() == "yes"
            is_rewatch = explicit_rewatch or had_summary or wrote_one
            rating_val = _snap_rating(row.get("Rating") or "")

            db.add(
                DiaryEntry(
                    user_id=user.id,
                    movie_id=movie.id,
                    watched_at=watched_at,
                    rating=rating_val,
                    is_rewatch=is_rewatch,
                    at_theatre=False,
                    visibility=visibility,
                )
            )
            await upsert_watch_summary(db, user.id, movie.id, watched_at)
            if rating_val is not None:
                # ratings.csv is processed first and owns the canonical rating;
                # only fill gaps from the diary so we never clobber it.
                await _set_rating_if_absent(db, user.id, movie.id, rating_val)

            existing_dates.add(dkey)
            wrote_one = True
            touched.add(movie.id)
            counts[source]["imported"] += 1
        await db.flush()

    return touched


# ── Endpoint ─────────────────────────────────────────────────────

@router.post("/letterboxd")
async def import_letterboxd(
    ratings: UploadFile | None = File(default=None),
    diary: UploadFile | None = File(default=None),
    watched: UploadFile | None = File(default=None),
    watchlist: UploadFile | None = File(default=None),
    visibility: str = Form("public"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Multipart upload — provide any combination of the four CSVs. Heavy: each
    unique title triggers one TMDB search (memoised across files). For very large
    diaries this may approach the request timeout; re-upload is safe (idempotent).
    Defer to a queue when libraries get bigger."""
    if not (ratings or diary or watched or watchlist):
        raise HTTPException(status_code=400, detail="Upload at least one CSV file")
    if visibility not in ("public", "private"):
        visibility = "public"

    ratings_rows = _rows((await ratings.read()).decode("utf-8", "ignore")) if ratings else []
    diary_rows = _rows((await diary.read()).decode("utf-8", "ignore")) if diary else []
    watched_rows = _rows((await watched.read()).decode("utf-8", "ignore")) if watched else []
    watchlist_rows = _rows((await watchlist.read()).decode("utf-8", "ignore")) if watchlist else []

    counts = {
        "ratings": {"imported": 0, "skipped": 0, "unresolved": 0},
        "diary": {"imported": 0, "skipped": 0, "unresolved": 0},
        "watched": {"imported": 0, "skipped": 0, "unresolved": 0},
        "watchlist": {"imported": 0, "skipped": 0, "unresolved": 0},
    }

    # One resolution pass over every unique (title, year) across all files.
    pairs: set[tuple[str, str | None]] = set()
    for rows in (ratings_rows, diary_rows, watched_rows, watchlist_rows):
        for row in rows:
            title = (row.get("Name") or "").strip()
            if title:
                pairs.add((title, (row.get("Year") or "").strip() or None))
    resolved = await _resolve_all(pairs)
    movie_cache: dict[int, Movie] = {}

    # ── ratings (canonical rating; processed first so diary never clobbers it) ──
    for row in ratings_rows:
        title = (row.get("Name") or "").strip()
        year = (row.get("Year") or "").strip() or None
        value = _snap_rating(row.get("Rating") or "")
        if not title or value is None:
            counts["ratings"]["skipped"] += 1
            continue
        tmdb_data = resolved.get((title, year))
        if not tmdb_data:
            counts["ratings"]["unresolved"] += 1
            continue
        movie = await _cached_movie(db, tmdb_data, movie_cache)
        existing = (
            await db.execute(
                select(Rating).where(Rating.user_id == user.id, Rating.movie_id == movie.id)
            )
        ).scalar_one_or_none()
        if existing:
            existing.value = value
            counts["ratings"]["skipped"] += 1
            continue
        db.add(Rating(user_id=user.id, movie_id=movie.id, value=value))
        counts["ratings"]["imported"] += 1
    await db.flush()

    # ── diary (the per-viewing file — dated DiaryEntry rows) ──
    diary_movie_ids = await _import_viewings(
        db, user, diary_rows, source="diary", visibility=visibility,
        date_col="Watched Date", counts=counts, resolved=resolved,
        movie_cache=movie_cache, skip_movie_ids=set(),
    )

    # ── watched (fallback: one viewing for films the diary didn't cover) ──
    await _import_viewings(
        db, user, watched_rows, source="watched", visibility=visibility,
        date_col="Date", counts=counts, resolved=resolved,
        movie_cache=movie_cache, skip_movie_ids=diary_movie_ids,
    )

    # ── watchlist (last — clear_lifecycle is deliberately NOT called during
    #    import, so these survive even when the same films were just logged) ──
    for row in watchlist_rows:
        title = (row.get("Name") or "").strip()
        year = (row.get("Year") or "").strip() or None
        if not title:
            counts["watchlist"]["skipped"] += 1
            continue
        tmdb_data = resolved.get((title, year))
        if not tmdb_data:
            counts["watchlist"]["unresolved"] += 1
            continue
        movie = await _cached_movie(db, tmdb_data, movie_cache)
        existing = (
            await db.execute(
                select(WatchlistItem).where(
                    WatchlistItem.user_id == user.id, WatchlistItem.movie_id == movie.id
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
            f"Imported {total_imported} entries. Your diary and Wrapped now "
            "reflect your history; the taste vector refreshes on your next visit."
        ),
    }
