"""
Taste Circles API — Phase 4.2

Private 6–12 person groups. Like a Slate Room, but membership-gated
and chat-style — for close-friends film culture.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.circles import (
    CIRCLE_MAX_MEMBERS,
    TasteCircle,
    TasteCircleMember,
    TasteCircleMessage,
)
from ..models.user import User

router = APIRouter(prefix="/api/circles", tags=["taste-circles"])


# ── Helpers ───────────────────────────────────────────────────


async def _get_or_404(circle_id: str, db: AsyncSession) -> TasteCircle:
    c = (
        await db.execute(select(TasteCircle).where(TasteCircle.id == circle_id))
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404)
    return c


async def _is_member(circle_id: str, user_id: str, db: AsyncSession) -> bool:
    row = (
        await db.execute(
            select(TasteCircleMember).where(
                TasteCircleMember.circle_id == circle_id,
                TasteCircleMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    return row is not None


async def _ensure_member(circle_id: str, user_id: str, db: AsyncSession) -> None:
    if not await _is_member(circle_id, user_id, db):
        raise HTTPException(status_code=403, detail="Not a member of this circle")


# ── CRUD ──────────────────────────────────────────────────────


class CreateCircleIn(BaseModel):
    name: str
    description: str | None = None


@router.post("")
async def create_circle(
    body: CreateCircleIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    c = TasteCircle(creator_id=user.id, name=name, description=body.description)
    db.add(c)
    await db.flush()
    db.add(TasteCircleMember(circle_id=c.id, user_id=user.id, role="admin"))
    await db.flush()
    return _payload(c, member_count=1)


@router.get("/mine")
async def list_my_circles(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(TasteCircle)
            .join(TasteCircleMember, TasteCircleMember.circle_id == TasteCircle.id)
            .where(TasteCircleMember.user_id == user.id)
            .order_by(desc(TasteCircle.created_at))
        )
    ).scalars().all()

    out = []
    for c in rows:
        member_count = (
            await db.execute(
                select(func.count()).where(TasteCircleMember.circle_id == c.id)
            )
        ).scalar_one()
        out.append(_payload(c, member_count=member_count))
    return {"items": out}


@router.get("/{circle_id}")
async def get_circle(
    circle_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _get_or_404(circle_id, db)
    await _ensure_member(c.id, user.id, db)

    members_rows = (
        await db.execute(
            select(TasteCircleMember, User)
            .join(User, User.id == TasteCircleMember.user_id)
            .where(TasteCircleMember.circle_id == c.id)
        )
    ).all()
    members = [
        {
            "id": u.id,
            "name": u.name,
            "username": u.username,
            "avatarUrl": u.avatar_url,
            "role": m.role,
        }
        for m, u in members_rows
    ]
    return {**_payload(c, member_count=len(members)), "members": members}


class InviteIn(BaseModel):
    user_id: str


@router.post("/{circle_id}/invite")
async def invite_member(
    circle_id: str,
    body: InviteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _get_or_404(circle_id, db)
    await _ensure_member(c.id, user.id, db)

    member_count = (
        await db.execute(
            select(func.count()).where(TasteCircleMember.circle_id == c.id)
        )
    ).scalar_one()
    if member_count >= c.max_members:
        raise HTTPException(
            status_code=400,
            detail=f"Circle is full ({c.max_members} members max)",
        )

    target = (
        await db.execute(select(User).where(User.id == body.user_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        await db.execute(
            select(TasteCircleMember).where(
                TasteCircleMember.circle_id == c.id,
                TasteCircleMember.user_id == target.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return {"ok": True, "alreadyMember": True}

    db.add(TasteCircleMember(circle_id=c.id, user_id=target.id, role="member"))
    await db.flush()
    return {"ok": True}


@router.delete("/{circle_id}/leave")
async def leave_circle(
    circle_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(TasteCircleMember).where(
                TasteCircleMember.circle_id == circle_id,
                TasteCircleMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True}


# ── Messages ──────────────────────────────────────────────────


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    tmdb_id: int | None = None


@router.get("/{circle_id}/messages")
async def list_messages(
    circle_id: str,
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_or_404(circle_id, db)
    await _ensure_member(circle_id, user.id, db)

    rows = (
        await db.execute(
            select(TasteCircleMessage, User)
            .join(User, User.id == TasteCircleMessage.user_id)
            .where(TasteCircleMessage.circle_id == circle_id)
            .order_by(desc(TasteCircleMessage.created_at))
            .limit(limit)
        )
    ).all()
    rows.reverse()
    return {
        "messages": [
            {
                "id": m.id,
                "body": m.body,
                "tmdbId": m.tmdb_id,
                "createdAt": m.created_at.isoformat(),
                "user": {
                    "id": u.id,
                    "name": u.name,
                    "username": u.username,
                    "avatarUrl": u.avatar_url,
                },
            }
            for m, u in rows
        ]
    }


@router.post("/{circle_id}/messages")
async def post_message(
    circle_id: str,
    body: MessageIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_or_404(circle_id, db)
    await _ensure_member(circle_id, user.id, db)

    msg = TasteCircleMessage(
        circle_id=circle_id,
        user_id=user.id,
        body=body.body.strip(),
        tmdb_id=body.tmdb_id,
    )
    db.add(msg)
    await db.flush()
    return {"id": msg.id, "createdAt": msg.created_at.isoformat()}


def _payload(c: TasteCircle, member_count: int) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "creatorId": c.creator_id,
        "memberCount": member_count,
        "maxMembers": c.max_members,
        "createdAt": c.created_at.isoformat(),
    }
