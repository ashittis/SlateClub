"""Per-viewing film diary (`watch_log`).

Each POST logs one viewing — rewatches are distinct dated rows, unlike the
one-row WatchHistory summary. A viewing records venue (home/theatre), an
optional rating snapshot, a rewatch flag, and per-entry public/private
visibility. Every write keeps the WatchHistory summary in sync via
services/diary_service so existing readers stay correct.
"""

from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import (
    CurrentlyWatching,
    DiaryEntry,
    DnfEntry,
    Rating,
    WatchlistItem,
)
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.diary_service import (
    clear_lifecycle,
    prune_summary_if_empty,
    summary_had_row,
    upsert_watch_summary,
)
from app.shared.services.watch_signals import record_rating_signals, record_watch_signals
from app.features.users.users import _movie_payload

router = APIRouter(prefix="/api/diary", tags=["diary"])


# ── Schemas ──────────────────────────────────────────────────

class DiaryEntryCreate(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    watched_at: date | None = Field(None, alias="watchedAt")
    rating: float | None = Field(None, ge=0.25, le=5.0, multiple_of=0.25)
    is_rewatch: bool | None = Field(None, alias="isRewatch")
    at_theatre: bool = Field(False, alias="atTheatre")
    visibility: str = "public"

    class Config:
        populate_by_name = True


class DiaryEntryPatch(BaseModel):
    watched_at: date | None = Field(None, alias="watchedAt")
    rating: float | None = Field(None, ge=0.25, le=5.0, multiple_of=0.25)
    is_rewatch: bool | None = Field(None, alias="isRewatch")
    at_theatre: bool | None = Field(None, alias="atTheatre")
    visibility: str | None = None

    class Config:
        populate_by_name = True


# ── Helpers ──────────────────────────────────────────────────

def _resolve_watched_at(d: date | None) -> datetime:
    if d is None:
        return datetime.now(timezone.utc)
    return datetime.combine(d, time(12, 0), tzinfo=timezone.utc)


def _entry_payload(entry: DiaryEntry, movie: Movie) -> dict:
    return {
        **_movie_payload(movie),
        "entryId": entry.id,
        "watchedAt": entry.watched_at.isoformat() if entry.watched_at else None,
        "rating": entry.rating,
        "isRewatch": entry.is_rewatch,
        "atTheatre": entry.at_theatre,
        "visibility": entry.visibility,
    }


# ── Routes ───────────────────────────────────────────────────

@router.post("")
async def log_viewing(
    body: DiaryEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = (
        await db.execute(select(Movie).where(Movie.id == body.movie_id))
    ).scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found in database")

    visibility = body.visibility if body.visibility in ("public", "private") else "public"
    watched_at = _resolve_watched_at(body.watched_at)
    had_summary = await summary_had_row(db, user.id, movie.id)
    is_rewatch = body.is_rewatch if body.is_rewatch is not None else had_summary

    # If a rating came with the log, upsert the canonical Rating too.
    rating_is_new = False
    if body.rating is not None:
        existing = (
            await db.execute(
                select(Rating).where(
                    Rating.user_id == user.id, Rating.movie_id == movie.id
                )
            )
        ).scalar_one_or_none()
        rating_is_new = existing is None
        if existing:
            existing.value = body.rating
        else:
            db.add(Rating(user_id=user.id, movie_id=movie.id, value=body.rating))

    entry = DiaryEntry(
        user_id=user.id,
        movie_id=movie.id,
        watched_at=watched_at,
        rating=body.rating,
        is_rewatch=is_rewatch,
        at_theatre=body.at_theatre,
        visibility=visibility,
    )
    db.add(entry)
    await upsert_watch_summary(db, user.id, movie.id, watched_at)
    await clear_lifecycle(db, user.id, movie.id, WatchlistItem, CurrentlyWatching, DnfEntry)
    await db.flush()

    if body.rating is not None:
        await record_rating_signals(db, user, movie, body.rating, rating_is_new)
    await record_watch_signals(db, user, movie, 100.0)

    return _entry_payload(entry, movie)


@router.get("")
async def my_diary(
    year: int | None = None,
    media_type: str | None = Query(None, alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's own viewings — including private ones — newest first."""
    stmt = (
        select(DiaryEntry, Movie)
        .join(Movie, DiaryEntry.movie_id == Movie.id)
        .where(DiaryEntry.user_id == user.id)
        .order_by(DiaryEntry.watched_at.desc())
    )
    if year is not None:
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        stmt = stmt.where(DiaryEntry.watched_at >= start, DiaryEntry.watched_at < end)
    if media_type:
        stmt = stmt.where(Movie.media_type == media_type)
    rows = (await db.execute(stmt)).all()
    return [_entry_payload(e, m) for e, m in rows]


async def _owned_entry(db: AsyncSession, entry_id: str, user_id: str) -> DiaryEntry:
    entry = (
        await db.execute(select(DiaryEntry).where(DiaryEntry.id == entry_id))
    ).scalar_one_or_none()
    if not entry or entry.user_id != user_id:
        raise HTTPException(status_code=404, detail="Diary entry not found")
    return entry


@router.patch("/{entry_id}")
async def edit_viewing(
    entry_id: str,
    body: DiaryEntryPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await _owned_entry(db, entry_id, user.id)
    if body.watched_at is not None:
        entry.watched_at = _resolve_watched_at(body.watched_at)
    if body.rating is not None:
        entry.rating = body.rating
    if body.is_rewatch is not None:
        entry.is_rewatch = body.is_rewatch
    if body.at_theatre is not None:
        entry.at_theatre = body.at_theatre
    if body.visibility in ("public", "private"):
        entry.visibility = body.visibility
    await db.flush()

    movie = (
        await db.execute(select(Movie).where(Movie.id == entry.movie_id))
    ).scalar_one()
    return _entry_payload(entry, movie)


@router.delete("/{entry_id}")
async def delete_viewing(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await _owned_entry(db, entry_id, user.id)
    movie_id = entry.movie_id
    await db.delete(entry)
    await db.flush()
    # Drop the summary only if that was the last viewing of this film.
    await prune_summary_if_empty(db, user.id, movie_id)
    return {"ok": True}
