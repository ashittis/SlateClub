"""Ratings — the user's current opinion of a film.

One row per (user, film). Distinct from the per-viewing snapshot stored on a
diary entry: rating a film again updates this, but never rewrites what you
thought at an earlier viewing.

Setting a rating never creates a diary entry. An opinion is not an event.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import Rating
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.films import film_payload

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


class RateBody(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    value: float = Field(..., ge=0.25, le=5.0, multiple_of=0.25)

    model_config = {"populate_by_name": True}


@router.post("")
async def set_rating(
    body: RateBody,
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
            select(Rating).where(Rating.user_id == user.id, Rating.movie_id == movie.id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.value = body.value
    else:
        db.add(Rating(user_id=user.id, movie_id=movie.id, value=body.value))
    await db.flush()
    return {"ok": True, "rating": body.value}


@router.get("")
async def my_ratings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Everything the caller has rated, most recently rated first."""
    rows = (
        await db.execute(
            select(Rating, Movie)
            .join(Movie, Rating.movie_id == Movie.id)
            .where(Rating.user_id == user.id)
            .order_by(Rating.updated_at.desc())
        )
    ).all()
    return [
        {**film_payload(m), "rating": r.value, "ratedAt": r.updated_at.isoformat()}
        for r, m in rows
    ]


@router.delete("/{movie_id}")
async def clear_rating(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Rating).where(Rating.user_id == user.id, Rating.movie_id == movie_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Rating not found")
    return {"ok": True}
