"""
Chapters API — Phase 4.3

City-level public communities and their events.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.chapters import Chapter, ChapterEvent, ChapterMember
from ..models.user import User

router = APIRouter(prefix="/api/chapters", tags=["chapters"])


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "chapter"


# ── Discovery ────────────────────────────────────────────────


@router.get("")
async def list_chapters(
    city: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Chapter).order_by(Chapter.name.asc()).limit(50)
    if city:
        stmt = stmt.where(Chapter.city.ilike(city))
    rows = (await db.execute(stmt)).scalars().all()

    out = []
    for c in rows:
        member_count = (
            await db.execute(
                select(func.count()).where(ChapterMember.chapter_id == c.id)
            )
        ).scalar_one()
        out.append({**_chapter_payload(c), "memberCount": member_count})
    return {"items": out}


@router.get("/{slug}")
async def get_chapter(
    slug: str,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(select(Chapter).where(Chapter.slug == slug))
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404)

    member_count = (
        await db.execute(
            select(func.count()).where(ChapterMember.chapter_id == c.id)
        )
    ).scalar_one()

    is_member = False
    if user:
        is_member = (
            await db.execute(
                select(ChapterMember).where(
                    ChapterMember.chapter_id == c.id,
                    ChapterMember.user_id == user.id,
                )
            )
        ).scalar_one_or_none() is not None

    return {
        **_chapter_payload(c),
        "memberCount": member_count,
        "isMember": is_member,
    }


class CreateChapterIn(BaseModel):
    name: str
    city: str
    description: str | None = None


@router.post("")
async def create_chapter(
    body: CreateChapterIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = _slugify(f"{body.city}-{body.name}")
    slug = base
    n = 1
    while (
        await db.execute(select(Chapter).where(Chapter.slug == slug))
    ).scalar_one_or_none() is not None:
        n += 1
        slug = f"{base}-{n}"

    c = Chapter(
        slug=slug,
        name=body.name.strip(),
        city=body.city.strip(),
        description=body.description,
    )
    db.add(c)
    await db.flush()
    db.add(ChapterMember(chapter_id=c.id, user_id=user.id))
    await db.flush()
    return _chapter_payload(c)


@router.post("/{slug}/join")
async def join_chapter(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(select(Chapter).where(Chapter.slug == slug))
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404)
    existing = (
        await db.execute(
            select(ChapterMember).where(
                ChapterMember.chapter_id == c.id,
                ChapterMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(ChapterMember(chapter_id=c.id, user_id=user.id))
        await db.flush()
    return {"ok": True}


@router.delete("/{slug}/join")
async def leave_chapter(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(select(Chapter).where(Chapter.slug == slug))
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404)
    row = (
        await db.execute(
            select(ChapterMember).where(
                ChapterMember.chapter_id == c.id,
                ChapterMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True}


# ── Events ────────────────────────────────────────────────────


class CreateEventIn(BaseModel):
    title: str
    description: str | None = None
    venue: str | None = None
    starts_at: datetime
    tmdb_id: int | None = None


@router.get("/{slug}/events")
async def list_events(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(select(Chapter).where(Chapter.slug == slug))
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404)
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(ChapterEvent)
            .where(ChapterEvent.chapter_id == c.id)
            .where(ChapterEvent.starts_at >= now)
            .order_by(ChapterEvent.starts_at.asc())
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "venue": e.venue,
                "startsAt": e.starts_at.isoformat(),
                "tmdbId": e.tmdb_id,
            }
            for e in rows
        ]
    }


@router.post("/{slug}/events")
async def create_event(
    slug: str,
    body: CreateEventIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(select(Chapter).where(Chapter.slug == slug))
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404)
    is_member = (
        await db.execute(
            select(ChapterMember).where(
                ChapterMember.chapter_id == c.id,
                ChapterMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none() is not None
    if not is_member:
        raise HTTPException(status_code=403, detail="Join the chapter first")

    e = ChapterEvent(
        chapter_id=c.id,
        title=body.title.strip(),
        description=body.description,
        venue=body.venue,
        starts_at=body.starts_at,
        tmdb_id=body.tmdb_id,
        created_by_user_id=user.id,
    )
    db.add(e)
    await db.flush()
    return {"id": e.id}


def _chapter_payload(c: Chapter) -> dict:
    return {
        "slug": c.slug,
        "name": c.name,
        "city": c.city,
        "region": c.region,
        "description": c.description,
        "createdAt": c.created_at.isoformat(),
    }
