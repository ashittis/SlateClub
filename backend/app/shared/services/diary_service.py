"""Shared helpers for the diary (`watch_log`) ↔ `WatchHistory` coexistence.

`watch_log` is the per-viewing source of truth; `WatchHistory` stays a derived
one-row-per-(user,movie) summary that ~9 existing readers depend on. Every
diary write keeps the summary in sync; a diary delete drops the summary only
when no viewings remain. Both the film-page slug wrappers (routes/movies.py)
and the diary router (routes/diary.py) go through here so the rule lives once.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.actions import DiaryEntry, WatchHistory


async def clear_lifecycle(db: AsyncSession, user_id: str, movie_id: str, *models) -> None:
    """Delete the user's row(s) for this movie from the given lifecycle tables,
    keeping Shelf/Watching/Watched/DNF mutually exclusive."""
    for model in models:
        row = (
            await db.execute(
                select(model).where(model.user_id == user_id, model.movie_id == movie_id)
            )
        ).scalar_one_or_none()
        if row:
            await db.delete(row)


async def upsert_watch_summary(
    db: AsyncSession, user_id: str, movie_id: str, watched_at: datetime
) -> WatchHistory:
    """Upsert the WatchHistory summary: completion 100%, watched_at advanced to
    the most recent viewing so existing 'last watched' readers stay correct."""
    existing = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.completion_pct = 100.0
        if watched_at and (existing.watched_at is None or watched_at > existing.watched_at):
            existing.watched_at = watched_at
        return existing
    row = WatchHistory(
        user_id=user_id,
        movie_id=movie_id,
        completion_pct=100.0,
        watched_at=watched_at or datetime.now(timezone.utc),
    )
    db.add(row)
    return row


async def summary_had_row(db: AsyncSession, user_id: str, movie_id: str) -> bool:
    """Whether a WatchHistory summary already exists — used to auto-detect a
    rewatch when the caller didn't say so."""
    return (
        await db.execute(
            select(WatchHistory.id).where(
                WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id
            )
        )
    ).scalar_one_or_none() is not None


async def prune_summary_if_empty(db: AsyncSession, user_id: str, movie_id: str) -> None:
    """After deleting a diary entry, drop the WatchHistory summary if it was the
    last remaining viewing for this (user, movie)."""
    remaining = (
        await db.execute(
            select(func.count())
            .select_from(DiaryEntry)
            .where(DiaryEntry.user_id == user_id, DiaryEntry.movie_id == movie_id)
        )
    ).scalar_one()
    if remaining == 0:
        summary = (
            await db.execute(
                select(WatchHistory).where(
                    WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id
                )
            )
        ).scalar_one_or_none()
        if summary:
            await db.delete(summary)
