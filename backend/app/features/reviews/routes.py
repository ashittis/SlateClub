"""Reviews — writing about a film.

A review belongs to the viewing that prompted it (KASET.md §8): it links user,
film, diary entry, rating and text. One review per (user, film) — rewriting
after a rewatch updates the same row and re-points it at the newer viewing,
rather than accumulating duplicates on one film page.

Writes go through `diary_service.upsert_review` so the diary/review link is
maintained in one place.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_optional_user
from app.core.database import get_db
from app.shared.models.actions import DiaryEntry, Rating, Review
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services import diary_service
from app.shared.services.films import film_payload
from app.shared.services.notify import notify

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewBody(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    body: str = Field(..., min_length=1)
    spoiler: bool = False
    diary_entry_id: str | None = Field(None, alias="diaryEntryId")

    model_config = {"populate_by_name": True}


def _payload(review: Review, author: User, rating: float | None = None) -> dict:
    return {
        "id": review.id,
        "movieId": review.movie_id,
        "diaryEntryId": review.diary_entry_id,
        "body": review.body,
        "spoiler": review.spoiler,
        "helpfulCount": review.helpful_count,
        "createdAt": review.created_at.isoformat(),
        # A review reads very differently next to the score it came with.
        "rating": rating,
        "author": {
            "id": author.id,
            "name": author.name,
            "username": author.username,
            "avatarUrl": author.avatar_url,
        },
    }


@router.post("")
async def write_review(
    body: ReviewBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = (
        await db.execute(select(Movie).where(Movie.id == body.movie_id))
    ).scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Film not found")

    # If a viewing was named, it must be the caller's own.
    if body.diary_entry_id:
        entry = (
            await db.execute(
                select(DiaryEntry).where(DiaryEntry.id == body.diary_entry_id)
            )
        ).scalar_one_or_none()
        if not entry or entry.user_id != user.id:
            raise HTTPException(status_code=404, detail="Diary entry not found")

    review = await diary_service.upsert_review(
        db,
        user_id=user.id,
        movie_id=movie.id,
        body=body.body,
        spoiler=body.spoiler,
        diary_entry_id=body.diary_entry_id,
    )

    if body.diary_entry_id:
        entry = (
            await db.execute(
                select(DiaryEntry).where(DiaryEntry.id == body.diary_entry_id)
            )
        ).scalar_one()
        entry.review_id = review.id
        await db.flush()

    rating = (
        await db.execute(
            select(Rating.value).where(
                Rating.user_id == user.id, Rating.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    return _payload(review, user, rating)


@router.get("/mine")
async def my_reviews(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Everything the caller has written, newest first — the Library's Reviews tab."""
    rows = (
        await db.execute(
            select(Review, Movie)
            .join(Movie, Review.movie_id == Movie.id)
            .where(Review.user_id == user.id)
            .order_by(Review.created_at.desc())
        )
    ).all()
    ratings = {
        r.movie_id: r.value
        for r in (
            await db.execute(select(Rating).where(Rating.user_id == user.id))
        ).scalars().all()
    }
    return [
        {
            **film_payload(movie),
            **_payload(review, user, ratings.get(review.movie_id)),
        }
        for review, movie in rows
    ]


@router.get("/film/{movie_id}")
async def reviews_for_film(
    movie_id: str,
    _viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Community reviews for a film, most helpful first, each with its author's
    rating so the score and the writing are read together."""
    rows = (
        await db.execute(
            select(Review, User)
            .join(User, Review.user_id == User.id)
            .where(Review.movie_id == movie_id)
            .order_by(Review.helpful_count.desc(), Review.created_at.desc())
        )
    ).all()

    ratings = {
        (r.user_id): r.value
        for r in (
            await db.execute(select(Rating).where(Rating.movie_id == movie_id))
        ).scalars().all()
    }
    return [_payload(review, author, ratings.get(author.id)) for review, author in rows]


@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    review = (
        await db.execute(select(Review).where(Review.id == review_id))
    ).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your review")

    # The viewing survives its review — diary_entries.review_id is SET NULL.
    await db.delete(review)
    await db.flush()
    return {"ok": True}


@router.post("/{review_id}/helpful")
async def mark_helpful(
    review_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    review = (
        await db.execute(select(Review).where(Review.id == review_id))
    ).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review.helpful_count += 1
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
    return {"ok": True, "helpfulCount": review.helpful_count}
