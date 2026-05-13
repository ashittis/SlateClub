"""
Critic Badges — Phase 4.4

Algorithmic power-user surfacing. A user earns the `critic` badge if:
  - they have ≥5 reviews in the last 30 days, AND
  - the median helpful_count of those reviews is ≥3.

Computed on-read. A nightly precompute job lives in ops; until that
job runs, this endpoint is the source of truth.
"""

from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..models.actions import Review
from ..models.user import User

router = APIRouter(prefix="/api/critics", tags=["critics"])


@router.get("/check/{username}")
async def check_critic(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    """Returns whether `username` is currently a Critic + their stats."""
    u = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404)

    since = datetime.now(timezone.utc) - timedelta(days=30)
    rows = (
        await db.execute(
            select(Review.helpful_count)
            .where(Review.user_id == u.id)
            .where(Review.created_at >= since)
        )
    ).all()
    helpful_counts = [int(r[0] or 0) for r in rows]
    review_count = len(helpful_counts)
    median_helpful = (
        statistics.median(helpful_counts) if helpful_counts else 0
    )
    is_critic = review_count >= 5 and median_helpful >= 3

    return {
        "username": u.username,
        "isCritic": is_critic,
        "reviewCountLast30d": review_count,
        "medianHelpful": median_helpful,
    }


@router.get("/leaderboard")
async def leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Top critics — users with the most cumulative helpful_count over
    the last 30 days. Useful for the Reviews tab "Top Critics" filter.
    """
    since = datetime.now(timezone.utc) - timedelta(days=30)

    # Aggregate per-user helpful_count + review_count.
    rows = (
        await db.execute(
            select(Review.user_id, Review.helpful_count, Review.created_at)
            .where(Review.created_at >= since)
        )
    ).all()

    by_user: dict[str, dict] = {}
    for uid, hc, _ in rows:
        cur = by_user.setdefault(
            uid, {"reviews": 0, "totalHelpful": 0, "helpfulList": []}
        )
        cur["reviews"] += 1
        cur["totalHelpful"] += int(hc or 0)
        cur["helpfulList"].append(int(hc or 0))

    if not by_user:
        return {"items": []}

    user_rows = (
        await db.execute(
            select(User).where(User.id.in_(list(by_user.keys())))
        )
    ).scalars().all()
    user_map = {u.id: u for u in user_rows}

    items = []
    for uid, stats in by_user.items():
        u = user_map.get(uid)
        if u is None:
            continue
        median_helpful = statistics.median(stats["helpfulList"])
        is_critic = stats["reviews"] >= 5 and median_helpful >= 3
        items.append(
            {
                "username": u.username,
                "name": u.name,
                "avatarUrl": u.avatar_url,
                "reviewCount": stats["reviews"],
                "totalHelpful": stats["totalHelpful"],
                "isCritic": is_critic,
            }
        )

    items.sort(key=lambda x: x["totalHelpful"], reverse=True)
    return {"items": items[:limit]}
