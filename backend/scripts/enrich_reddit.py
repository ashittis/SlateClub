"""Offline Reddit cache-warmer — populates reddit_cache for the catalog so the
identity extractor can run at full LLM speed against a warm cache.

Run from backend/:

    python -m scripts.enrich_reddit --limit 200                # warm 200 films
    python -m scripts.enrich_reddit --refresh                  # refetch this month
    python -m scripts.enrich_reddit --limit 200 --concurrency 4

Reddit-bound (~6s/film). Splitting this from extract_movie_identities means you
pay the Reddit wall-clock ONCE, then re-run extraction freely. Requires
REDDIT_CLIENT_ID/SECRET; degrades to a no-op message otherwise.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.integrations import reddit
from app.shared.services.reddit_enrich import _REDDIT_CACHE_VERSION, get_or_fetch_discussion

# Import every model module so SQLAlchemy resolves string relationships.
from app import models_registry  # noqa: F401
from app.shared.models.movie import Movie
from app.shared.models.reddit_cache import RedditCache
from datetime import datetime, timezone


async def run(*, limit: int | None, refresh: bool, concurrency: int) -> None:
    if not reddit.is_available():
        print("[reddit] REDDIT_CLIENT_ID/SECRET not set — nothing to do.")
        return

    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    async with Session() as session:
        # Films with no fresh cache row for the current month + version.
        fresh_ids = set(
            (await session.execute(
                select(RedditCache.tmdb_id).where(
                    RedditCache.month == month,
                    RedditCache.version == _REDDIT_CACHE_VERSION,
                )
            )).scalars().all()
        )
        stmt = select(Movie).where(Movie.tmdb_id.isnot(None))
        if limit:
            stmt = stmt.limit(limit * 4 if not refresh else limit)  # headroom to skip fresh
        movies = list((await session.execute(stmt)).scalars().all())
        if not refresh:
            movies = [m for m in movies if m.tmdb_id not in fresh_ids]
        if limit:
            movies = movies[:limit]

        total = len(movies)
        print(f"[reddit] warming {total} films  (concurrency={concurrency})")

        # Reddit's rate gate is global, so gather() here just overlaps the
        # per-film comment fetches; throughput stays ≤60 req/min.
        done = 0
        sem = asyncio.Semaphore(max(1, concurrency))

        async def _warm(m: Movie):
            async with sem:
                year = (m.release_date or "")[:4] or None
                text = await get_or_fetch_discussion(
                    session, m.tmdb_id, m.title or "", year, m.original_language, refresh=refresh
                )
                return bool(text)

        for i in range(0, total, 10):
            batch = movies[i : i + 10]
            hits = await asyncio.gather(*(_warm(m) for m in batch))
            await session.commit()
            done += len(batch)
            print(f"[reddit] {done}/{total}  with-text={sum(1 for h in hits if h)}")

        print(f"[reddit] done. warmed {total} films for {month}.")

    await engine.dispose()
    await reddit.aclose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="Cap films warmed.")
    parser.add_argument("--refresh", action="store_true", help="Ignore cache; refetch this month.")
    parser.add_argument("--concurrency", type=int, default=1, help="Overlapping fetches (Reddit stays ≤60/min).")
    args = parser.parse_args()
    asyncio.run(run(limit=args.limit, refresh=args.refresh, concurrency=args.concurrency))


if __name__ == "__main__":
    main()
