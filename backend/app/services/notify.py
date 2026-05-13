"""
Notification dispatcher — Phase 2.3

A thin helper called by other routers when they want to write a
notification row for a recipient. Keeps notification policy in one
place so it's easy to add throttling, deduping, or push later.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.notifications import NOTIFICATION_KINDS, Notification


async def notify(
    db: AsyncSession,
    *,
    user_id: str,
    kind: str,
    payload: dict[str, Any],
) -> Notification | None:
    """
    Create a notification for `user_id`. Returns the row, or None if
    the kind is unknown (silently skipped — callers shouldn't need to
    know the registry).
    """
    if kind not in NOTIFICATION_KINDS:
        return None
    n = Notification(user_id=user_id, kind=kind, payload=payload)
    db.add(n)
    await db.flush()
    return n
