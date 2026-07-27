"""Reddit discussion cache — the bridge between integrations.reddit (fetch) and
the offline identity extractor. Month-keyed so it self-expires at month
boundaries; `version` invalidates all rows when the regex/sub list changes.

Offline only. Never called from the request path."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import reddit
from app.shared.models.reddit_cache import RedditCache

_REDDIT_CACHE_VERSION = 1


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def get_or_fetch_discussion(
    session: AsyncSession,
    tmdb_id: int,
    title: str,
    year: str | None,
    language: str | None,
    *,
    refresh: bool = False,
) -> str:
    """Return cached Reddit discussion text for this film/month, fetching + caching
    on a miss. Returns "" when Reddit is unconfigured — callers treat that as
    'no external context' and proceed TMDB-only."""
    month = _current_month()

    if not refresh:
        row = await session.get(RedditCache, (tmdb_id, month))
        if row is not None and row.version == _REDDIT_CACHE_VERSION and isinstance(row.payload, dict):
            return row.payload.get("text", "")

    if not reddit.is_available():
        return ""

    text = await reddit.discussion_text(title, year, language)
    payload = {
        "text": text,
        "sentences": len([s for s in text.split("\n") if s]) if text else 0,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    row = await session.get(RedditCache, (tmdb_id, month))
    if row is None:
        session.add(
            RedditCache(tmdb_id=tmdb_id, month=month, version=_REDDIT_CACHE_VERSION, payload=payload)
        )
    else:
        row.version = _REDDIT_CACHE_VERSION
        row.payload = payload
    return text
