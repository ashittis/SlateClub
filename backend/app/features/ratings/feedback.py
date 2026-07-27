import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import Rating
from app.shared.models.movie import Movie
from app.shared.models.social import CalibrationResponse, MicroFeedback
from app.shared.models.user import User

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

CALIBRATION_LIMIT = 10  # number of calibration pairs before considered complete


# ── Schemas ──────────────────────────────────────────────────

class MicroFeedbackCreate(BaseModel):
    # Callers send camelCase `movieId`; accept both so a snake_case body
    # still validates. The value may be an internal Movie.id string (film
    # page) or a numeric TMDB id (hero feed sends it as a JSON number) —
    # accept int | str and the route normalises it below.
    movie_id: str | int = Field(alias="movieId")
    type: str  # e.g. "skip", "not_interested", "seen_it", "love_it"

    model_config = ConfigDict(populate_by_name=True)


class MicroFeedbackResponse(BaseModel):
    id: str
    movie_id: str
    type: str

    class Config:
        from_attributes = True


class CalibrationCreate(BaseModel):
    type: str  # e.g. "pairwise"
    value: dict  # e.g. {"winner_id": "...", "loser_id": "..."}


# ── Routes ───────────────────────────────────────────────────

@router.post("/micro", response_model=MicroFeedbackResponse)
async def submit_micro_feedback(
    body: MicroFeedbackCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Normalise to an internal Movie.id so downstream exclusion (feed.py
    # filters the hero pick by Movie.id) always matches. Callers pass either
    # the internal id or a TMDB id; resolve both, preferring the internal id.
    raw_id = str(body.movie_id)
    movie = (
        await db.execute(select(Movie).where(Movie.id == raw_id))
    ).scalar_one_or_none()
    if movie is None and raw_id.isdigit():
        movie = (
            await db.execute(
                select(Movie).where(Movie.tmdb_id == int(raw_id))
            )
        ).scalar_one_or_none()
    resolved_id = movie.id if movie else raw_id

    fb = MicroFeedback(user_id=user.id, movie_id=resolved_id, type=body.type)
    db.add(fb)
    await db.flush()
    return fb


@router.get("/micro", response_model=list[MicroFeedbackResponse])
async def get_micro_feedback(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MicroFeedback)
        .where(MicroFeedback.user_id == user.id)
        .order_by(MicroFeedback.created_at.desc())
    )
    return result.scalars().all()


@router.post("/calibration")
async def submit_calibration(
    body: CalibrationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cr = CalibrationResponse(user_id=user.id, type=body.type, value=body.value)
    db.add(cr)
    await db.flush()
    return {"ok": True}


@router.get("/calibration/status")
async def calibration_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (
        await db.execute(
            select(func.count()).where(CalibrationResponse.user_id == user.id)
        )
    ).scalar() or 0

    return {
        "completed": count,
        "required": CALIBRATION_LIMIT,
        "active": count < CALIBRATION_LIMIT,
    }


@router.get("/calibration/pair")
async def calibration_pair(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return two random rated films for pairwise comparison."""
    result = await db.execute(
        select(Rating, Movie)
        .join(Movie, Rating.movie_id == Movie.id)
        .where(Rating.user_id == user.id)
    )
    rows = result.all()

    if len(rows) < 2:
        raise HTTPException(
            status_code=400, detail="Need at least 2 rated movies for calibration"
        )

    pair = random.sample(rows, 2)
    return {
        "movies": [
            {
                "id": m.id,
                "tmdb_id": m.tmdb_id,
                "title": m.title,
                "poster_path": m.poster_path,
                "user_rating": r.value,
            }
            for r, m in pair
        ]
    }
