"""The default watchlist — films the user means to watch.

One implicit list per user. Named collections are a separate concept and arrive
with the watchlists slice in Phase 9.

Logging a film removes it from here: watching is terminal for "to watch". That
rule lives in `diary_service`, not in this file.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import WatchlistItem
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.films import film_payload

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class AddBody(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    note: str | None = None

    model_config = {"populate_by_name": True}


@router.post("")
async def add(
    body: AddBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = (
        await db.execute(select(Movie).where(Movie.id == body.movie_id))
    ).scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Film not found")

    existing = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id, WatchlistItem.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        if body.note is not None:
            existing.note = body.note
    else:
        db.add(WatchlistItem(user_id=user.id, movie_id=movie.id, note=body.note))
    await db.flush()
    return {"ok": True}


@router.get("")
async def my_watchlist(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's watchlist, most recently added first."""
    rows = (
        await db.execute(
            select(WatchlistItem, Movie)
            .join(Movie, WatchlistItem.movie_id == Movie.id)
            .where(WatchlistItem.user_id == user.id)
            .order_by(WatchlistItem.created_at.desc())
        )
    ).all()
    return [
        {**film_payload(m), "note": w.note, "addedAt": w.created_at.isoformat()}
        for w, m in rows
    ]


@router.delete("/{movie_id}")
async def remove(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id, WatchlistItem.movie_id == movie_id
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Not on your watchlist")
    await db.delete(row)
    await db.flush()
    return {"ok": True}
