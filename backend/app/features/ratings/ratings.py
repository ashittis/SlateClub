from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import Rating
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.taste_cache import invalidate_user_taste_vector
from app.shared.services.watch_signals import record_rating_signals

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


# ── Schemas ──────────────────────────────────────────────────

class RatingCreate(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    value: float = Field(..., ge=0.25, le=5.0, multiple_of=0.25)

    class Config:
        populate_by_name = True


class RatingResponse(BaseModel):
    id: str
    user_id: str
    movie_id: str
    value: float

    class Config:
        from_attributes = True


class RatingWithMovie(RatingResponse):
    movie: dict | None = None


# ── Routes ───────────────────────────────────────────────────

@router.post("/", response_model=RatingResponse)
async def rate_movie(
    body: RatingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify movie exists
    movie_result = await db.execute(select(Movie).where(Movie.id == body.movie_id))
    movie_obj = movie_result.scalar_one_or_none()
    if not movie_obj:
        raise HTTPException(status_code=404, detail="Movie not found in database")

    # Upsert
    result = await db.execute(
        select(Rating).where(Rating.user_id == user.id, Rating.movie_id == body.movie_id)
    )
    rating = result.scalar_one_or_none()
    is_new = rating is None

    if rating:
        rating.value = body.value
    else:
        rating = Rating(user_id=user.id, movie_id=body.movie_id, value=body.value)
        db.add(rating)

    await db.flush()

    # Graph hydration + pairwise similarity + bandit reward + embedding refresh
    # + taste-vector invalidation. See services/watch_signals.py.
    await record_rating_signals(db, user, movie_obj, body.value, is_new)

    return rating


@router.get("/{movie_id}", response_model=RatingResponse | None)
async def get_rating(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Rating).where(Rating.user_id == user.id, Rating.movie_id == movie_id)
    )
    rating = result.scalar_one_or_none()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    return rating


@router.get("/", response_model=list[RatingWithMovie])
async def get_all_ratings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Rating, Movie)
        .join(Movie, Rating.movie_id == Movie.id)
        .where(Rating.user_id == user.id)
        .order_by(Rating.updated_at.desc())
    )
    rows = result.all()
    return [
        RatingWithMovie(
            id=r.id,
            user_id=r.user_id,
            movie_id=r.movie_id,
            value=r.value,
            movie={
                "id": m.id,
                "tmdb_id": m.tmdb_id,
                "title": m.title,
                "poster_path": m.poster_path,
                "release_date": m.release_date,
            },
        )
        for r, m in rows
    ]


@router.delete("/{movie_id}")
async def delete_rating(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Rating).where(Rating.user_id == user.id, Rating.movie_id == movie_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Rating not found")
    await invalidate_user_taste_vector(user.id)
    return {"ok": True}
