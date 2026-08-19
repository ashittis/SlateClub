"""The diary — one row per viewing.

This is the centre of Kaset: `log → rate → review` all happen here, in one
request, because that is how the user experiences it. Writes go through
`diary_service`, which owns the consistency rules across diary_entries,
ratings, reviews and watch_history.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import WATCH_TYPES, DiaryEntry, Review
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services import diary_service
from app.shared.services.films import film_payload

router = APIRouter(prefix="/api/diary", tags=["diary"])


class LogBody(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    watched_on: date | None = Field(None, alias="watchedOn")
    rating: float | None = Field(None, ge=0.25, le=5.0, multiple_of=0.25)
    liked: bool = False
    is_rewatch: bool | None = Field(None, alias="isRewatch")
    watch_type: str | None = Field(None, alias="watchType")
    theatre_name: str | None = Field(None, alias="theatreName")
    theatre_city: str | None = Field(None, alias="theatreCity")
    theatre_format: str | None = Field(None, alias="theatreFormat")
    tags: list[str] | None = None
    visibility: str | None = None
    review: str | None = None
    review_spoiler: bool = Field(False, alias="reviewSpoiler")

    model_config = {"populate_by_name": True}


class EditBody(BaseModel):
    watched_on: date | None = Field(None, alias="watchedOn")
    rating: float | None = Field(None, ge=0.25, le=5.0, multiple_of=0.25)
    liked: bool | None = None
    is_rewatch: bool | None = Field(None, alias="isRewatch")
    watch_type: str | None = Field(None, alias="watchType")
    theatre_name: str | None = Field(None, alias="theatreName")
    theatre_city: str | None = Field(None, alias="theatreCity")
    theatre_format: str | None = Field(None, alias="theatreFormat")
    tags: list[str] | None = None
    visibility: str | None = None

    model_config = {"populate_by_name": True}


def entry_payload(entry: DiaryEntry, movie: Movie, review: Review | None = None) -> dict:
    return {
        **film_payload(movie),
        "entryId": entry.id,
        "watchedOn": entry.watched_on.isoformat() if entry.watched_on else None,
        "rating": entry.rating,
        "liked": entry.liked,
        "isRewatch": entry.is_rewatch,
        "watchType": entry.watch_type,
        "tags": list(entry.tags or []),
        "theatre": (
            {
                "name": entry.theatre_name,
                "city": entry.theatre_city,
                "format": entry.theatre_format,
            }
            if entry.watch_type == "theatre"
            else None
        ),
        "visibility": entry.visibility,
        "review": (
            {"id": review.id, "body": review.body, "spoiler": review.spoiler}
            if review
            else None
        ),
    }


async def _owned_entry(db: AsyncSession, entry_id: str, user_id: str) -> DiaryEntry:
    entry = (
        await db.execute(select(DiaryEntry).where(DiaryEntry.id == entry_id))
    ).scalar_one_or_none()
    if not entry or entry.user_id != user_id:
        raise HTTPException(status_code=404, detail="Diary entry not found")
    return entry


@router.post("")
async def log_viewing(
    body: LogBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log one viewing — optionally with a rating and a review in the same act."""
    if body.watch_type is not None and body.watch_type not in WATCH_TYPES:
        raise HTTPException(
            status_code=422, detail=f"watchType must be one of {', '.join(WATCH_TYPES)}"
        )
    if body.watched_on and body.watched_on > date.today():
        raise HTTPException(status_code=422, detail="You can't log a future viewing")

    movie = (
        await db.execute(select(Movie).where(Movie.id == body.movie_id))
    ).scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Film not found")

    entry = await diary_service.log_viewing(
        db,
        user_id=user.id,
        movie_id=movie.id,
        watched_on=body.watched_on,
        rating=body.rating,
        liked=body.liked,
        is_rewatch=body.is_rewatch,
        watch_type=body.watch_type,
        theatre_name=body.theatre_name,
        theatre_city=body.theatre_city,
        theatre_format=body.theatre_format,
        tags=body.tags,
        visibility=body.visibility,
        review_body=body.review,
        review_spoiler=body.review_spoiler,
    )

    review = None
    if entry.review_id:
        review = (
            await db.execute(select(Review).where(Review.id == entry.review_id))
        ).scalar_one_or_none()
    return entry_payload(entry, movie, review)


@router.get("")
async def my_diary(
    year: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's own viewings — including private ones — newest first."""
    stmt = (
        select(DiaryEntry, Movie)
        .join(Movie, DiaryEntry.movie_id == Movie.id)
        .where(DiaryEntry.user_id == user.id)
        .order_by(DiaryEntry.watched_on.desc(), DiaryEntry.created_at.desc())
    )
    if year is not None:
        stmt = stmt.where(
            DiaryEntry.watched_on >= date(year, 1, 1),
            DiaryEntry.watched_on <= date(year, 12, 31),
        )
    rows = (await db.execute(stmt)).all()

    review_ids = [e.review_id for e, _ in rows if e.review_id]
    reviews = {}
    if review_ids:
        reviews = {
            r.id: r
            for r in (
                await db.execute(select(Review).where(Review.id.in_(review_ids)))
            ).scalars().all()
        }

    return [entry_payload(e, m, reviews.get(e.review_id)) for e, m in rows]


@router.patch("/{entry_id}")
async def edit_viewing(
    entry_id: str,
    body: EditBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.watch_type is not None and body.watch_type not in WATCH_TYPES:
        raise HTTPException(
            status_code=422, detail=f"watchType must be one of {', '.join(WATCH_TYPES)}"
        )
    entry = await _owned_entry(db, entry_id, user.id)
    await diary_service.edit_viewing(
        db,
        entry,
        watched_on=body.watched_on,
        rating=body.rating,
        liked=body.liked,
        is_rewatch=body.is_rewatch,
        watch_type=body.watch_type,
        theatre_name=body.theatre_name,
        theatre_city=body.theatre_city,
        theatre_format=body.theatre_format,
        tags=body.tags,
        visibility=body.visibility,
    )
    movie = (
        await db.execute(select(Movie).where(Movie.id == entry.movie_id))
    ).scalar_one()
    # Load the review too: without it the response claims `review: null` for an
    # entry that has one, and a client trusting the response would wipe it.
    review = None
    if entry.review_id:
        review = (
            await db.execute(select(Review).where(Review.id == entry.review_id))
        ).scalar_one_or_none()
    return entry_payload(entry, movie, review)


@router.delete("/{entry_id}")
async def delete_viewing(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await _owned_entry(db, entry_id, user.id)
    await diary_service.delete_viewing(db, entry)
    return {"ok": True}
