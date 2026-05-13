from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.actions import WatchHistory
from ..models.movie import Movie
from ..models.user import User

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
    movie = await db.execute(select(Movie).where(Movie.id == body.movie_id))
    if not movie.scalar_one_or_none():
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
