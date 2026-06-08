"""
Film DMs — 'Recommend' a film to a user's inbox. The recipient can reply only
with a fixed template reaction (no free text) and add the film to their
watchlist. Lives next to notifications in the UI.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.actions import WatchlistItem
from ..models.dms import FilmDM
from ..models.movie import Movie
from ..models.user import User
from ..services.notify import notify

router = APIRouter(prefix="/api/dms", tags=["dms"])

REACTIONS = {"peak", "mid", "never_again", "worst_ever", "absolute_worst"}


class SendBody(BaseModel):
    recipient_ids: list[str] = Field(alias="recipientIds")
    tmdb_id: int = Field(alias="tmdbId")

    class Config:
        populate_by_name = True


class ReactionBody(BaseModel):
    reaction: str


def _actor(u: User) -> dict:
    return {"id": u.id, "name": u.name, "username": u.username, "avatarUrl": u.avatar_url}


@router.post("")
async def send_dm(
    body: SendBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.recipient_ids:
        raise HTTPException(status_code=400, detail="Pick at least one person")
    from .movies import _get_or_fetch_movie

    movie = await _get_or_fetch_movie(body.tmdb_id, db)
    sent = 0
    for rid in dict.fromkeys(body.recipient_ids):
        if rid == me.id:
            continue
        db.add(FilmDM(sender_id=me.id, recipient_id=rid, movie_id=movie.id))
        await notify(
            db, user_id=rid, kind="film_recommend",
            payload={"actor": _actor(me), "movieId": movie.tmdb_id, "movieTitle": movie.title},
        )
        sent += 1
    await db.flush()
    return {"ok": True, "sent": sent}


@router.get("")
async def inbox(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(FilmDM, Movie, User)
            .join(Movie, FilmDM.movie_id == Movie.id)
            .join(User, User.id == FilmDM.sender_id)
            .where(FilmDM.recipient_id == me.id)
            .order_by(FilmDM.created_at.desc())
        )
    ).all()
    movie_ids = [m.id for _, m, _ in rows]
    watchlisted: set[str] = set()
    if movie_ids:
        watchlisted = {
            r[0] for r in (
                await db.execute(
                    select(WatchlistItem.movie_id).where(
                        WatchlistItem.user_id == me.id,
                        WatchlistItem.movie_id.in_(movie_ids),
                    )
                )
            ).all()
        }
    return {
        "items": [
            {
                "id": dm.id,
                "tmdbId": m.tmdb_id,
                "title": m.title,
                "posterPath": m.poster_path,
                "from": _actor(u),
                "reaction": dm.reaction,
                "read": dm.read_at is not None,
                "watchlisted": m.id in watchlisted,
                "createdAt": dm.created_at,
            }
            for dm, m, u in rows
        ]
    }


@router.get("/unread-count")
async def unread_count(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = (
        await db.execute(
            select(func.count(FilmDM.id)).where(
                FilmDM.recipient_id == me.id, FilmDM.read_at.is_(None)
            )
        )
    ).scalar_one() or 0
    return {"count": int(n)}


async def _my_dm(db: AsyncSession, dm_id: str, me_id: str) -> FilmDM:
    dm = (
        await db.execute(
            select(FilmDM).where(FilmDM.id == dm_id, FilmDM.recipient_id == me_id)
        )
    ).scalar_one_or_none()
    if dm is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return dm


@router.post("/{dm_id}/read")
async def mark_read(
    dm_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dm = await _my_dm(db, dm_id, me.id)
    if dm.read_at is None:
        dm.read_at = datetime.now(timezone.utc)
    return {"ok": True}


@router.post("/{dm_id}/reaction")
async def react(
    dm_id: str,
    body: ReactionBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.reaction not in REACTIONS:
        raise HTTPException(status_code=400, detail="Invalid reaction")
    dm = await _my_dm(db, dm_id, me.id)
    dm.reaction = body.reaction
    if dm.read_at is None:
        dm.read_at = datetime.now(timezone.utc)
    movie = await db.get(Movie, dm.movie_id)
    await notify(
        db, user_id=dm.sender_id, kind="dm_reaction",
        payload={
            "actor": _actor(me),
            "movieId": movie.tmdb_id if movie else None,
            "movieTitle": movie.title if movie else None,
            "reaction": body.reaction,
        },
    )
    return {"ok": True}
