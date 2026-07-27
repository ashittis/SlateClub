from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import Review
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.notify import notify

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


# ── Schemas ──────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    movie_id: str
    body: str
    spoiler: bool = False
    # 0 = whole title; >0 = a specific season's review (series only).
    season_number: int = 0


class ReviewResponse(BaseModel):
    id: str
    user_id: str
    movie_id: str
    season_number: int
    body: str
    spoiler: bool
    helpful_count: int
    user: dict | None = None

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────

@router.post("/", response_model=ReviewResponse)
async def create_or_update_review(
    body: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify movie exists
    movie = await db.execute(select(Movie).where(Movie.id == body.movie_id))
    if not movie.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Movie not found in database")

    # Upsert (one review per user per movie per season; season 0 = whole title)
    result = await db.execute(
        select(Review).where(
            Review.user_id == user.id,
            Review.movie_id == body.movie_id,
            Review.season_number == body.season_number,
        )
    )
    review = result.scalar_one_or_none()

    if review:
        review.body = body.body
        review.spoiler = body.spoiler
    else:
        review = Review(
            user_id=user.id,
            movie_id=body.movie_id,
            season_number=body.season_number,
            body=body.body,
            spoiler=body.spoiler,
        )
        db.add(review)

    await db.flush()
    return ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        movie_id=review.movie_id,
        season_number=review.season_number,
        body=review.body,
        spoiler=review.spoiler,
        helpful_count=review.helpful_count,
        user={"id": user.id, "name": user.name, "username": user.username, "avatar_url": user.avatar_url},
    )


@router.get("/movie/{movie_id}", response_model=list[ReviewResponse])
async def get_movie_reviews(
    movie_id: str,
    sort: str = "helpful",
    season: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Review, User)
        .join(User, Review.user_id == User.id)
        .where(Review.movie_id == movie_id)
    )
    if season is not None:
        query = query.where(Review.season_number == season)

    if sort == "helpful":
        query = query.order_by(Review.helpful_count.desc())
    else:
        query = query.order_by(Review.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    return [
        ReviewResponse(
            id=r.id,
            user_id=r.user_id,
            movie_id=r.movie_id,
            season_number=r.season_number,
            body=r.body,
            spoiler=r.spoiler,
            helpful_count=r.helpful_count,
            user={"id": u.id, "name": u.name, "username": u.username, "avatar_url": u.avatar_url},
        )
        for r, u in rows
    ]


@router.post("/{review_id}/helpful")
async def mark_helpful(
    review_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review.helpful_count = review.helpful_count + 1
    await db.flush()

    if review.user_id != user.id:
        await notify(
            db,
            user_id=review.user_id,
            kind="review_helpful",
            payload={
                "reviewId": review.id,
                "movieId": review.movie_id,
                "actor": {
                    "id": user.id,
                    "name": user.name,
                    "username": user.username,
                    "avatarUrl": user.avatar_url,
                },
            },
        )
    return {"ok": True, "helpful_count": review.helpful_count}


@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your review")

    await db.delete(review)
    await db.flush()
    return {"ok": True}
