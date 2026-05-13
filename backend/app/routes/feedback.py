import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.actions import Rating
from ..models.movie import Movie
from ..models.social import CalibrationResponse, MicroFeedback
from ..models.user import User

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

CALIBRATION_LIMIT = 10  # number of calibration pairs before considered complete


# ── Schemas ──────────────────────────────────────────────────

class MicroFeedbackCreate(BaseModel):
    movie_id: str
    type: str  # e.g. "skip", "not_interested", "seen_it", "love_it"


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
    fb = MicroFeedback(user_id=user.id, movie_id=body.movie_id, type=body.type)
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
