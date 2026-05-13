"""
Festivals API — Phase 3.4

List active/upcoming festivals, fetch a festival, and post live updates
during the festival window.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.festivals import Festival, FestivalPost
from ..models.user import User

router = APIRouter(prefix="/api/festivals", tags=["festivals"])


@router.get("/active")
async def active_festivals(
    db: AsyncSession = Depends(get_db),
):
    """
    Festivals currently within their window. Powers the Community
    `festival` tab — the tab only renders when this is non-empty.
    """
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(Festival)
            .where(Festival.starts_at <= now)
            .where(Festival.ends_at >= now)
            .order_by(Festival.starts_at.asc())
        )
    ).scalars().all()
    return {"items": [_payload(f) for f in rows]}


@router.get("/upcoming")
async def upcoming_festivals(
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(Festival)
            .where(Festival.starts_at > now)
            .order_by(Festival.starts_at.asc())
            .limit(20)
        )
    ).scalars().all()
    return {"items": [_payload(f) for f in rows]}


@router.get("/{slug}")
async def get_festival(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    f = (
        await db.execute(select(Festival).where(Festival.slug == slug))
    ).scalar_one_or_none()
    if f is None:
        raise HTTPException(status_code=404)
    return _payload(f)


@router.get("/{slug}/posts")
async def list_festival_posts(
    slug: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    f = (
        await db.execute(select(Festival).where(Festival.slug == slug))
    ).scalar_one_or_none()
    if f is None:
        raise HTTPException(status_code=404)
    rows = (
        await db.execute(
            select(FestivalPost, User)
            .join(User, User.id == FestivalPost.user_id)
            .where(FestivalPost.festival_id == f.id)
            .order_by(desc(FestivalPost.created_at))
            .limit(limit)
        )
    ).all()
    return {
        "items": [
            {
                "id": p.id,
                "body": p.body,
                "tmdbId": p.tmdb_id,
                "createdAt": p.created_at.isoformat(),
                "user": {
                    "id": u.id,
                    "name": u.name,
                    "username": u.username,
                    "avatarUrl": u.avatar_url,
                },
            }
            for p, u in rows
        ]
    }


class PostIn(BaseModel):
    body: str
    tmdb_id: int | None = None


@router.post("/{slug}/posts")
async def create_festival_post(
    slug: str,
    body: PostIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    f = (
        await db.execute(select(Festival).where(Festival.slug == slug))
    ).scalar_one_or_none()
    if f is None:
        raise HTTPException(status_code=404)
    now = datetime.now(timezone.utc)
    if not (f.starts_at <= now <= f.ends_at):
        raise HTTPException(
            status_code=400, detail="Festival is not currently live."
        )
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty post")
    post = FestivalPost(
        festival_id=f.id,
        user_id=user.id,
        body=text,
        tmdb_id=body.tmdb_id,
    )
    db.add(post)
    await db.flush()
    return {"id": post.id}


def _payload(f: Festival) -> dict:
    now = datetime.now(timezone.utc)
    live = f.starts_at <= now <= f.ends_at
    return {
        "slug": f.slug,
        "name": f.name,
        "city": f.city,
        "startsAt": f.starts_at.isoformat(),
        "endsAt": f.ends_at.isoformat(),
        "bannerUrl": f.banner_url,
        "description": f.description,
        "live": live,
    }
