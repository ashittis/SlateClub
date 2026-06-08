from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.actions import WatchlistItem
from ..models.movie import Movie
from ..models.user import User
from ..services.taste_cache import invalidate_user_taste_vector

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


# ── Schemas ──────────────────────────────────────────────────

class WatchlistAdd(BaseModel):
    movie_id: str = Field(..., alias="movieId")

    class Config:
        populate_by_name = True


class WatchlistResponse(BaseModel):
    id: str
    user_id: str
    movie_id: str

    class Config:
        from_attributes = True


class WatchlistWithMovie(WatchlistResponse):
    movie: dict | None = None


# ── Routes ───────────────────────────────────────────────────

@router.post("/", response_model=WatchlistResponse)
async def add_to_watchlist(
    body: WatchlistAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await db.execute(select(Movie).where(Movie.id == body.movie_id))
    if not movie.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Movie not found in database")

    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id, WatchlistItem.movie_id == body.movie_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already in watchlist")

    item = WatchlistItem(user_id=user.id, movie_id=body.movie_id)
    db.add(item)
    await db.flush()
    await invalidate_user_taste_vector(user.id)
    return item


@router.get("/", response_model=list[WatchlistWithMovie])
async def get_watchlist(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistItem, Movie)
        .join(Movie, WatchlistItem.movie_id == Movie.id)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.created_at.desc())
    )
    rows = result.all()
    return [
        WatchlistWithMovie(
            id=w.id,
            user_id=w.user_id,
            movie_id=w.movie_id,
            movie={
                "id": m.id,
                "tmdb_id": m.tmdb_id,
                "title": m.title,
                "poster_path": m.poster_path,
                "release_date": m.release_date,
            },
        )
        for w, m in rows
    ]


@router.delete("/{movie_id}")
async def remove_from_watchlist(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(WatchlistItem).where(
            WatchlistItem.user_id == user.id, WatchlistItem.movie_id == movie_id
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    await invalidate_user_taste_vector(user.id)
    return {"ok": True}
