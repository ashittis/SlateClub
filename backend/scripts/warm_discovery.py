"""Offline warmer for the Community Intelligence Engine.

Builds + caches the web-sourced community consensus pool for seed films, so the
request path (POST /api/discovery/consensus) only ever reads a warm cache. You
pay the Reddit/web-search + LLM wall-clock ONCE per seed per month here.

Run from backend/:

    python -m scripts.warm_discovery --limit 20          # 20 most popular local films
    python -m scripts.warm_discovery --tmdb 335984 27205 # specific seeds
    python -m scripts.warm_discovery --refresh --limit 5 # rebuild even if cached

Idempotent: skips seeds already cached for the current month unless --refresh.
Gracefully no-ops the sources that aren't configured (Reddit / Brave); if neither
is available it still runs but produces empty pools (nothing is cached).

Cost note: ~4 web searches + several Reddit calls + 2–4 LLM calls per seed.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.core.database import async_session
from app.features.discovery.community_engine import (
    _COMMUNITY_VERSION,
    _current_month,
    build_and_cache,
)
from app.integrations import reddit, websearch
from app.ml.llm import openai_client as llm

# Import every model so SQLAlchemy resolves string-named relationships.
from app import models_registry  # noqa: F401
from app.shared.models.discovery_cache import DiscoveryCache
from app.shared.models.movie import Movie
from app.features.movies.movies import _get_or_fetch_movie


async def _already_warm(session, tmdb_id: int) -> bool:
    row = await session.get(DiscoveryCache, (tmdb_id, _current_month()))
    return row is not None and row.version == _COMMUNITY_VERSION


async def _seed_ids(session, *, explicit: list[int] | None, limit: int | None) -> list[int]:
    if explicit:
        return explicit
    stmt = select(Movie.tmdb_id).where(Movie.media_type == "movie").order_by(
        Movie.popularity.desc().nullslast()
    )
    if limit:
        stmt = stmt.limit(limit)
    return [r[0] for r in (await session.execute(stmt)).all()]


async def run(*, explicit: list[int] | None, limit: int | None, refresh: bool) -> None:
    if not llm.is_available():
        print("[warm] OPENAI_API_KEY not set — extraction/reasoning will no-op. Aborting.")
        return
    if not reddit.is_available() and not websearch.is_available():
        print("[warm] neither Reddit nor Brave configured — nothing to gather. Aborting.")
        return

    async with async_session() as session:
        ids = await _seed_ids(session, explicit=explicit, limit=limit)
        print(f"[warm] {len(ids)} seed(s) to consider")

        built = skipped = empty = 0
        for tmdb_id in ids:
            if not refresh and await _already_warm(session, tmdb_id):
                skipped += 1
                continue
            try:
                seed = await _get_or_fetch_movie(tmdb_id, session, "movie")
                payload = await build_and_cache(session, seed)
                await session.commit()
            except Exception as exc:  # noqa: BLE001
                await session.rollback()
                print(f"[warm] {tmdb_id}: FAILED — {exc}")
                continue
            n = len(payload.get("candidates") or [])
            if n:
                built += 1
                print(f"[warm] {tmdb_id} {seed.title!r}: {n} candidates cached")
            else:
                empty += 1
                print(f"[warm] {tmdb_id} {seed.title!r}: no community signal (not cached)")
        print(f"[warm] done — built={built} skipped={skipped} empty={empty}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Warm the Community Intelligence Engine cache.")
    ap.add_argument("--tmdb", type=int, nargs="*", help="specific TMDB seed ids")
    ap.add_argument("--limit", type=int, default=None, help="cap on popular-film seeds")
    ap.add_argument("--refresh", action="store_true", help="rebuild even if cached this month")
    args = ap.parse_args()
    asyncio.run(run(explicit=args.tmdb or None, limit=args.limit, refresh=args.refresh))


if __name__ == "__main__":
    main()
