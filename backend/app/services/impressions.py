"""Impression logging — captures every recommendation surfaced to a user.

Without impression logs we can't compute "shown but not clicked"
negatives for Phase B XGBoost training. Free to capture now,
impossible to backfill later.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.social import Impression


async def log_impressions(
    db: AsyncSession,
    *,
    user_id: str,
    items: list[dict],
    default_surface: str = "for_you",
) -> str:
    """Bulk-log impressions for a single recommendation request.

    `items` is a list of dicts that already came out of the pipeline
    (so they may contain `_surface` / `_rank_score` / `id`).

    Returns the request-scoped session_id so callers can correlate
    follow-on interactions if they want to.
    """
    if not items:
        return ""

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    rows = []
    for position, item in enumerate(items):
        movie_id = item.get("id")
        if not movie_id:
            continue
        rows.append(
            Impression(
                user_id=user_id,
                movie_id=str(movie_id),
                surface=item.get("_surface") or default_surface,
                position=position,
                rank_score=item.get("_rank_score"),
                session_id=session_id,
                shown_at=now,
            )
        )

    if rows:
        db.add_all(rows)
        # Caller's outer transaction will commit; flush makes the
        # writes visible if anything in the same handler reads back.
        await db.flush()

    return session_id
