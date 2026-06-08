from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..ml.llm.contextual_bandit import bandit
from ..models.actions import Rating, WatchHistory
from ..models.movie import Movie
from ..models.social import Follow, Impression
from ..models.user import User
from ..services.taste_cache import invalidate_user_taste_vector

router = APIRouter(prefix="/api/watch-history", tags=["watch-history"])


# ── Schemas ──────────────────────────────────────────────────

class WatchHistoryCreate(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    completion_pct: float = Field(100.0, alias="completionPct", ge=0.0, le=100.0)

    class Config:
        populate_by_name = True


class WatchHistoryResponse(BaseModel):
    id: str
    user_id: str
    movie_id: str
    completion_pct: float

    class Config:
        from_attributes = True


class WatchHistoryWithMovie(WatchHistoryResponse):
    movie: dict | None = None


# ── Routes ───────────────────────────────────────────────────

@router.post("/", response_model=WatchHistoryResponse)
async def mark_watched(
    body: WatchHistoryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie_result = await db.execute(select(Movie).where(Movie.id == body.movie_id))
    movie_obj = movie_result.scalar_one_or_none()
    if not movie_obj:
        raise HTTPException(status_code=404, detail="Movie not found in database")

    # Upsert
    result = await db.execute(
        select(WatchHistory).where(
            WatchHistory.user_id == user.id, WatchHistory.movie_id == body.movie_id
        )
    )
    entry = result.scalar_one_or_none()

    if entry:
        entry.completion_pct = body.completion_pct
    else:
        entry = WatchHistory(
            user_id=user.id,
            movie_id=body.movie_id,
            completion_pct=body.completion_pct,
        )
        db.add(entry)

    await db.flush()

    # ── Graph hydration ─────────────────────────────────────────────────
    try:
        from ..ml.graph import taste_graph
        genre_names = [
            g.get("name", "") for g in (movie_obj.genres or []) if isinstance(g, dict)
        ]
        await taste_graph.upsert_movie_node(
            movie_obj.id, movie_obj.tmdb_id or 0, movie_obj.title or "", genre_names
        )
        await taste_graph.upsert_user_node(user.id, user.name, user.username)
        await taste_graph.set_user_watched(
            user.id, body.movie_id, weight=body.completion_pct / 100.0
        )
    except Exception as exc:
        print(f"[watch-history] graph hydration failed: {exc}")

    # ── Contextual bandit reward ────────────────────────────────────────
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        imp_result = await db.execute(
            select(Impression)
            .where(
                Impression.user_id == user.id,
                Impression.movie_id == body.movie_id,
                Impression.shown_at >= cutoff,
                Impression.source.isnot(None),
            )
            .order_by(Impression.shown_at.desc())
            .limit(1)
        )
        impression = imp_result.scalar_one_or_none()
        if impression:
            n_ratings = (
                await db.execute(
                    select(func.count(Rating.id)).where(Rating.user_id == user.id)
                )
            ).scalar_one() or 0
            n_follows = (
                await db.execute(
                    select(func.count(Follow.id)).where(Follow.follower_id == user.id)
                )
            ).scalar_one() or 0
            days = max((datetime.now(timezone.utc) - user.created_at).days, 0)
            segment = bandit.classify_user(n_ratings, n_follows, days)
            bandit.record_reward(
                segment,
                impression.source,
                clicked=True,
                watch_through=body.completion_pct / 100.0,
                rating=None,
            )
    except Exception as exc:
        print(f"[watch-history] bandit reward failed: {exc}")

    await invalidate_user_taste_vector(user.id)

    return entry


@router.get("/", response_model=list[WatchHistoryWithMovie])
async def get_watch_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchHistory, Movie)
        .join(Movie, WatchHistory.movie_id == Movie.id)
        .where(WatchHistory.user_id == user.id)
        .order_by(WatchHistory.watched_at.desc())
    )
    rows = result.all()
    return [
        WatchHistoryWithMovie(
            id=wh.id,
            user_id=wh.user_id,
            movie_id=wh.movie_id,
            completion_pct=wh.completion_pct,
            movie={
                "id": m.id,
                "tmdb_id": m.tmdb_id,
                "title": m.title,
                "poster_path": m.poster_path,
                "release_date": m.release_date,
            },
        )
        for wh, m in rows
    ]


@router.get("/{movie_id}")
async def check_watched(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchHistory).where(
            WatchHistory.user_id == user.id, WatchHistory.movie_id == movie_id
        )
    )
    entry = result.scalar_one_or_none()
    return {
        "watched": entry is not None,
        "completion_pct": entry.completion_pct if entry else None,
    }
