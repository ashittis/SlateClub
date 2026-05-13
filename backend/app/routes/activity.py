from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.movie import Movie
from ..models.social import ActivityEvent, Follow
from ..models.user import User

router = APIRouter(prefix="/api/activity", tags=["activity"])


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
    Feed scope:
      network — events from people you follow (default).
      artists — events from users flagged as artists (P3 — column TBD;
                today behaves like network until the flag is added).
      world   — top-engagement events globally over the last 24h.
      all     — network ∪ world (interleaved by recency).
    """
    query = (
        select(ActivityEvent, User)
        .join(User, ActivityEvent.user_id == User.id)
        .order_by(ActivityEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if scope in ("network", "all", "artists"):
        following_result = await db.execute(
            select(Follow.following_id).where(Follow.follower_id == user.id)
        )
        following_ids = [row[0] for row in following_result.all()]
        if scope == "network":
            if not following_ids:
                return {"events": [], "total": 0, "scope": scope}
            query = query.where(ActivityEvent.user_id.in_(following_ids))
        elif scope == "artists":
            # Stub: until users.is_artist exists, fall back to network.
            if not following_ids:
                return {"events": [], "total": 0, "scope": scope}
            query = query.where(ActivityEvent.user_id.in_(following_ids))

    if scope == "world":
        # Last 24h, exclude self.
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        query = query.where(
            ActivityEvent.created_at >= since,
            ActivityEvent.user_id != user.id,
        )

    result = await db.execute(query)
    rows = result.all()

    # Enrich with movie data where applicable
    events = []
    for event, evt_user in rows:
        entry: dict = {
            "id": event.id,
            "type": event.type,
            "movie_id": event.movie_id,
            "target_id": event.target_id,
            "metadata": event.event_metadata,
            "created_at": event.created_at.isoformat(),
            "user": {
                "id": evt_user.id,
                "name": evt_user.name,
                "username": evt_user.username,
                "avatar_url": evt_user.avatar_url,
            },
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

    return {"events": events, "total": len(events), "scope": scope}


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
