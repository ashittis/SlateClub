"""The single writer for viewings.

Logging a film touches four tables that must stay consistent:

  diary_entries   the viewing itself (append-only in spirit — never overwritten)
  ratings         the user's *current* opinion, if they rated while logging
  reviews         their writing, if any, linked back to the viewing
  watch_history   a derived "have they seen it?" summary

No route writes those directly. Everything goes through `log_viewing`,
`edit_viewing` and `delete_viewing` here, so the consistency rules live in one
place instead of being re-implemented (and drifting) per route.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.actions import (
    WATCH_TYPES,
    DiaryEntry,
    Rating,
    Review,
    WatchHistory,
    WatchlistItem,
)


def normalise_watch_type(value: str | None) -> str:
    return value if value in WATCH_TYPES else "streaming"


def normalise_visibility(value: str | None) -> str:
    return value if value in ("public", "private") else "public"


#: Caps on tags. Generous enough that nobody legitimate hits them, tight enough
#: that the column can't be used as free storage.
MAX_TAGS = 8
MAX_TAG_LENGTH = 32


def normalise_tags(values: list[str] | None) -> list[str]:
    """Lowercase, trim, drop blanks, de-duplicate, cap.

    Normalising here rather than at the route is what makes "IMAX", "imax" and
    " imax " the same tag no matter which caller wrote it — the CSV importer
    and the log panel both come through this door.
    """
    if not values:
        return []

    cleaned: list[str] = []
    for raw in values:
        tag = raw.strip().lstrip("#").strip().lower()[:MAX_TAG_LENGTH]
        # Order is preserved rather than sorted: the user's own ordering is the
        # only meaning these carry.
        if tag and tag not in cleaned:
            cleaned.append(tag)
        if len(cleaned) == MAX_TAGS:
            break
    return cleaned


async def has_seen(db: AsyncSession, user_id: str, movie_id: str) -> bool:
    """Whether any viewing exists — the default for the rewatch flag when the
    caller doesn't say."""
    return (
        await db.execute(
            select(WatchHistory.id).where(
                WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id
            )
        )
    ).scalar_one_or_none() is not None


async def _upsert_watch_summary(
    db: AsyncSession, user_id: str, movie_id: str, watched_on: date
) -> None:
    """Keep the derived summary pointing at the most recent viewing.

    Note the guard: logging an *older* viewing (backfilling last year's diary)
    must not drag "last watched" backwards.
    """
    when = datetime.combine(watched_on, datetime.min.time(), tzinfo=timezone.utc)
    existing = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.completion_pct = 100.0
        if existing.watched_at is None or when > existing.watched_at:
            existing.watched_at = when
        return
    db.add(
        WatchHistory(
            user_id=user_id, movie_id=movie_id, completion_pct=100.0, watched_at=when
        )
    )


async def _resync_watch_summary(db: AsyncSession, user_id: str, movie_id: str) -> None:
    """Rebuild the summary from what's actually in the diary.

    Called after an edit or delete, where the correct value can only be derived
    from the remaining rows — incremental patching gets this wrong as soon as
    the deleted entry was the most recent one.
    """
    latest = (
        await db.execute(
            select(func.max(DiaryEntry.watched_on)).where(
                DiaryEntry.user_id == user_id, DiaryEntry.movie_id == movie_id
            )
        )
    ).scalar_one()

    summary = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id
            )
        )
    ).scalar_one_or_none()

    if latest is None:
        if summary:
            await db.delete(summary)
        return

    when = datetime.combine(latest, datetime.min.time(), tzinfo=timezone.utc)
    if summary:
        summary.watched_at = when
        summary.completion_pct = 100.0
    else:
        db.add(
            WatchHistory(
                user_id=user_id, movie_id=movie_id, completion_pct=100.0, watched_at=when
            )
        )


async def _set_current_rating(
    db: AsyncSession, user_id: str, movie_id: str, value: float
) -> None:
    existing = (
        await db.execute(
            select(Rating).where(Rating.user_id == user_id, Rating.movie_id == movie_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.value = value
    else:
        db.add(Rating(user_id=user_id, movie_id=movie_id, value=value))


async def _drop_from_watchlist(db: AsyncSession, user_id: str, movie_id: str) -> None:
    """Watching is terminal for the watchlist — a film you've seen shouldn't
    still be sitting in "to watch"."""
    row = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user_id, WatchlistItem.movie_id == movie_id
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)


async def log_viewing(
    db: AsyncSession,
    *,
    user_id: str,
    movie_id: str,
    watched_on: date | None = None,
    rating: float | None = None,
    liked: bool = False,
    is_rewatch: bool | None = None,
    watch_type: str | None = None,
    theatre_name: str | None = None,
    theatre_city: str | None = None,
    theatre_format: str | None = None,
    tags: list[str] | None = None,
    visibility: str | None = None,
    review_body: str | None = None,
    review_spoiler: bool = False,
) -> DiaryEntry:
    """Record one viewing. Never overwrites an earlier one."""
    when = watched_on or datetime.now(timezone.utc).date()
    resolved_type = normalise_watch_type(watch_type)

    # Unstated rewatch is inferred from whether they've seen it before, which is
    # right far more often than defaulting to False.
    rewatch = is_rewatch if is_rewatch is not None else await has_seen(db, user_id, movie_id)

    entry = DiaryEntry(
        user_id=user_id,
        movie_id=movie_id,
        watched_on=when,
        rating=rating,
        liked=liked,
        is_rewatch=rewatch,
        watch_type=resolved_type,
        tags=normalise_tags(tags),
        # Theatre details are meaningless for a non-theatre viewing; drop them
        # rather than storing a cinema name against a streaming log.
        theatre_name=theatre_name if resolved_type == "theatre" else None,
        theatre_city=theatre_city if resolved_type == "theatre" else None,
        theatre_format=theatre_format if resolved_type == "theatre" else None,
        visibility=normalise_visibility(visibility),
    )
    db.add(entry)
    await db.flush()

    if rating is not None:
        await _set_current_rating(db, user_id, movie_id, rating)

    if review_body and review_body.strip():
        review = await upsert_review(
            db,
            user_id=user_id,
            movie_id=movie_id,
            body=review_body,
            spoiler=review_spoiler,
            diary_entry_id=entry.id,
        )
        entry.review_id = review.id

    await _upsert_watch_summary(db, user_id, movie_id, when)
    await _drop_from_watchlist(db, user_id, movie_id)
    await db.flush()
    return entry


async def edit_viewing(
    db: AsyncSession,
    entry: DiaryEntry,
    *,
    watched_on: date | None = None,
    rating: float | None = None,
    liked: bool | None = None,
    is_rewatch: bool | None = None,
    watch_type: str | None = None,
    theatre_name: str | None = None,
    theatre_city: str | None = None,
    theatre_format: str | None = None,
    tags: list[str] | None = None,
    visibility: str | None = None,
) -> DiaryEntry:
    if watched_on is not None:
        entry.watched_on = watched_on
    if rating is not None:
        entry.rating = rating
        await _set_current_rating(db, entry.user_id, entry.movie_id, rating)
    if liked is not None:
        entry.liked = liked
    if tags is not None:
        entry.tags = normalise_tags(tags)
    if is_rewatch is not None:
        entry.is_rewatch = is_rewatch
    if watch_type is not None:
        entry.watch_type = normalise_watch_type(watch_type)
        if entry.watch_type != "theatre":
            entry.theatre_name = entry.theatre_city = entry.theatre_format = None
    if entry.watch_type == "theatre":
        if theatre_name is not None:
            entry.theatre_name = theatre_name
        if theatre_city is not None:
            entry.theatre_city = theatre_city
        if theatre_format is not None:
            entry.theatre_format = theatre_format
    if visibility is not None:
        entry.visibility = normalise_visibility(visibility)

    await db.flush()
    await _resync_watch_summary(db, entry.user_id, entry.movie_id)
    await db.flush()
    return entry


async def delete_viewing(db: AsyncSession, entry: DiaryEntry) -> None:
    user_id, movie_id = entry.user_id, entry.movie_id
    await db.delete(entry)
    await db.flush()
    await _resync_watch_summary(db, user_id, movie_id)
    await db.flush()


async def upsert_review(
    db: AsyncSession,
    *,
    user_id: str,
    movie_id: str,
    body: str,
    spoiler: bool = False,
    diary_entry_id: str | None = None,
) -> Review:
    """One review per (user, film). Rewriting after a rewatch updates the same
    row and re-points it at the newer viewing."""
    review = (
        await db.execute(
            select(Review).where(Review.user_id == user_id, Review.movie_id == movie_id)
        )
    ).scalar_one_or_none()

    if review:
        review.body = body
        review.spoiler = spoiler
        if diary_entry_id:
            review.diary_entry_id = diary_entry_id
    else:
        review = Review(
            user_id=user_id,
            movie_id=movie_id,
            body=body,
            spoiler=spoiler,
            diary_entry_id=diary_entry_id,
        )
        db.add(review)

    await db.flush()
    return review
