from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import DiaryEntry, Rating, Review, WatchlistItem
from app.shared.models.movie import Movie
from app.shared.models.social import ActivityEvent, Follow
from app.shared.models.user import User

router = APIRouter(prefix="/api/activity", tags=["activity"])


# ── Helpers ──────────────────────────────────────────────────


def _as_datetime(ts: date | datetime) -> datetime:
    """Normalise a source timestamp to an aware datetime.

    The diary stores a calendar `date` while every other source stores a
    timestamp. Mixing the two breaks both the id (`date` has no .timestamp())
    and the merge sort, so all sources are levelled here rather than at each
    call site.
    """
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    return datetime.combine(ts, time.min, tzinfo=timezone.utc)


def _event(
    etype: str, ts: date | datetime, u: User, m: Movie, metadata: dict | None = None
) -> dict:
    ts = _as_datetime(ts)
    return {
        "id": f"{etype}:{u.id}:{m.id}:{int(ts.timestamp())}",
        "userId": u.id,
        "type": etype,
        "movieId": m.id,
        "targetId": None,
        "metadata": metadata,
        "createdAt": ts.isoformat(),
        "user": {
            "id": u.id,
            "name": u.name,
            "username": u.username,
            "avatar_url": u.avatar_url,
        },
        "movie": {
            "id": m.id,
            "title": m.title,
            "tmdbId": m.tmdb_id,
            "posterPath": m.poster_path,
        },
        "_ts": ts,
    }


async def _collect(
    db: AsyncSession,
    user_ids: list[str] | None,
    exclude_id: str | None,
    cap: int,
) -> list[dict]:
    """Build a merged activity stream from the real source tables.

    user_ids=None → everyone; otherwise only those users. Each source is
    capped, then everything is merged and sorted by recency by the caller.
    """
    events: list[dict] = []

    # "watched" comes from the per-viewing diary; only public viewings surface
    # in others' feeds (private ones stay owner-only, seen via the Diary tab).
    sources = [
        (Rating, Rating.user_id, Rating.movie_id, Rating.updated_at, "rated"),
        (DiaryEntry, DiaryEntry.user_id, DiaryEntry.movie_id, DiaryEntry.watched_on, "logged"),
        (WatchlistItem, WatchlistItem.user_id, WatchlistItem.movie_id, WatchlistItem.created_at, "watchlisted"),
        (Review, Review.user_id, Review.movie_id, Review.created_at, "reviewed"),
    ]

    for Model, uid_col, mid_col, ts_col, etype in sources:
        q = (
            select(Model, Movie, User)
            .join(Movie, mid_col == Movie.id)
            .join(User, User.id == uid_col)
            .order_by(ts_col.desc())
            .limit(cap)
        )
        if Model is DiaryEntry:
            q = q.where(DiaryEntry.visibility == "public")
        if user_ids is not None:
            q = q.where(uid_col.in_(user_ids))
        if exclude_id is not None:
            q = q.where(uid_col != exclude_id)

        for row, m, u in (await db.execute(q)).all():
            ts = getattr(row, ts_col.key)
            if etype == "rated":
                meta = {"rating": row.value}
            elif etype == "logged":
                meta = {"rewatch": row.is_rewatch, "watchType": row.watch_type}
                if row.rating is not None:
                    meta["rating"] = row.rating
            else:
                meta = None
            events.append(_event(etype, ts, u, m, meta))

    return events


# ── Routes ───────────────────────────────────────────────────


@router.get("/feed")
async def activity_feed(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    scope: str = Query("network", pattern="^(network|artists|world|all)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Feed derived live from real activity (ratings, watches, shelves, reviews).
      network / artists — people you follow.
      world             — everyone except you.
      all               — everyone, including you.
    """
    user_ids: list[str] | None
    exclude_id: str | None = None

    if scope in ("network", "artists"):
        following = [
            r[0] for r in (
                await db.execute(
                    select(Follow.following_id).where(Follow.follower_id == user.id)
                )
            ).all()
        ]
        if not following:
            return {"events": [], "total": 0, "scope": scope}
        user_ids = following
    elif scope == "world":
        user_ids = None
        exclude_id = user.id
    else:  # all
        user_ids = None

    cap = offset + limit
    events = await _collect(db, user_ids, exclude_id, cap)
    events.sort(key=lambda e: e["_ts"], reverse=True)
    page = events[offset : offset + limit]
    for e in page:
        e.pop("_ts", None)

    return {"events": page, "total": len(page), "scope": scope}


@router.get("/user/{user_id}")
async def user_activity(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify target user exists
    target = await db.execute(select(User).where(User.id == user_id))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    query = (
        select(ActivityEvent)
        .where(ActivityEvent.user_id == user_id)
        .order_by(ActivityEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    events_raw = result.scalars().all()

    events = []
    for event in events_raw:
        entry: dict = {
            "id": event.id,
            "type": event.type,
            "movie_id": event.movie_id,
            "target_id": event.target_id,
            "metadata": event.event_metadata,
            "created_at": event.created_at.isoformat(),
        }

        if event.movie_id:
            movie_result = await db.execute(
                select(Movie).where(Movie.id == event.movie_id)
            )
            movie = movie_result.scalar_one_or_none()
            if movie:
                entry["movie"] = {
                    "id": movie.id,
                    "tmdb_id": movie.tmdb_id,
                    "title": movie.title,
                    "poster_path": movie.poster_path,
                }

        events.append(entry)

    return {"events": events, "total": len(events)}
