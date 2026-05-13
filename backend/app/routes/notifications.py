"""
Notifications API — Phase 2.3
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.notifications import Notification
from ..models.user import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(desc(Notification.created_at))
        .limit(limit)
    )
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            stmt = stmt.where(Notification.created_at < cursor_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid cursor")

    rows = (await db.execute(stmt)).scalars().all()
    items = [
        {
            "id": n.id,
            "kind": n.kind,
            "payload": n.payload,
            "readAt": n.read_at and n.read_at.isoformat(),
            "createdAt": n.created_at.isoformat(),
        }
        for n in rows
    ]
    next_cursor = items[-1]["createdAt"] if len(items) == limit else None
    return {"items": items, "nextCursor": next_cursor}


@router.get("/unread-count")
async def unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = (
        await db.execute(
            select(func.count())
            .where(Notification.user_id == user.id)
            .where(Notification.read_at.is_(None))
        )
    ).scalar_one()
    return {"count": n}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(Notification)
            .where(Notification.id == notification_id)
            .where(Notification.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404)
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        await db.flush()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id)
        .where(Notification.read_at.is_(None))
        .values(read_at=now)
    )
    return {"ok": True}
