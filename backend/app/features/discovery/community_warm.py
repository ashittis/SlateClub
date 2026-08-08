"""Off-response warming for the Community Intelligence Engine.

Building a seed's community pool is expensive (multi-source scrape + LLM) and
Reddit's rate gate is process-global — so it must never block a request. Both
entry points here open their OWN AsyncSession (never the request's, which closes
when the response is sent):

- schedule_warm(): fire-and-forget from the request path on a cache miss.
  Single-flighted per seed (a burst of viewers on the same film triggers one
  build) and globally capped by a semaphore so concurrent warms don't stampede
  Reddit's gate. Best-effort — failures are swallowed because the essence
  fallback already answered the user.
- warm_seed(): awaitable single-seed build used by scripts/warm_discovery.py.

This is the pragmatic bridge for a codebase with no job queue. A real queue
remains the eventual home for this work (see RECS_TRAINING_PLAN.md).
"""

from __future__ import annotations

import asyncio

from app.core.database import async_session
from app.features.discovery.community_engine import build_and_cache

# Cap concurrent warms regardless of how many cache misses arrive at once.
# Reddit's gate is global anyway; this just bounds open sessions + LLM calls.
_MAX_CONCURRENT_WARMS = 2
_sem = asyncio.Semaphore(_MAX_CONCURRENT_WARMS)
_inflight: set[int] = set()


async def warm_seed(seed_tmdb_id: int, media_type: str = "movie") -> dict | None:
    """Build + cache one seed's community pool in a fresh session. Awaitable;
    returns the payload or None on failure. Safe to call from the CLI warmer."""
    from app.features.movies.movies import _get_or_fetch_movie

    async with async_session() as session:
        try:
            seed = await _get_or_fetch_movie(seed_tmdb_id, session, media_type)
            payload = await build_and_cache(session, seed)
            await session.commit()
            return payload
        except Exception as exc:  # noqa: BLE001
            await session.rollback()
            print(f"[discovery] warm_seed failed for {seed_tmdb_id}: {exc}")
            return None


def schedule_warm(seed_tmdb_id: int, media_type: str = "movie") -> None:
    """Fire-and-forget warm from the request path. No-op if this seed is already
    warming or if there's no running event loop."""
    if seed_tmdb_id in _inflight:
        return
    _inflight.add(seed_tmdb_id)

    async def _run() -> None:
        try:
            async with _sem:
                await warm_seed(seed_tmdb_id, media_type)
        finally:
            _inflight.discard(seed_tmdb_id)

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        # No running loop (e.g. called outside async context) — drop the guard.
        _inflight.discard(seed_tmdb_id)
