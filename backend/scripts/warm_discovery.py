"""Warm the discovery pool for films.

The expensive half of discovery — Reddit, Brave, and two LLM passes — happens
here, offline. The request path only ranks what this leaves behind, so a page
never waits on a rate-limited source and never fails because a key is missing
(KASET.md §9).

    python -m scripts.warm_discovery --limit 20
    python -m scripts.warm_discovery --tmdb 157336 496243
    python -m scripts.warm_discovery --refresh --limit 5

Safe to re-run: each pass replaces that seed's evidence.
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import func, select

# Import side-effects only: SQLAlchemy needs every model registered before any
# mapper resolves, and this script touches Movie, which relates to Rating et al.
from app import models_registry  # noqa: F401
from app.core.database import async_session
from app.features.discovery import pipeline
from app.shared.models.discovery_evidence import DiscoveryEvidence
from app.shared.models.movie import Movie

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("warm_discovery")


async def _seeds(session, limit: int, tmdb_ids: list[int] | None, refresh: bool) -> list[Movie]:
    if tmdb_ids:
        return (
            await session.execute(select(Movie).where(Movie.tmdb_id.in_(tmdb_ids)))
        ).scalars().all()

    stmt = select(Movie).order_by(Movie.popularity.desc().nullslast()).limit(limit)
    if not refresh:
        # Skip films already warmed, so a repeated run makes progress instead of
        # redoing the same head of the list.
        warmed = select(DiscoveryEvidence.seed_tmdb_id).distinct()
        stmt = (
            select(Movie)
            .where(Movie.tmdb_id.not_in(warmed))
            .order_by(Movie.popularity.desc().nullslast())
            .limit(limit)
        )
    return (await session.execute(stmt)).scalars().all()


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=10, help="how many films to warm")
    ap.add_argument("--tmdb", type=int, nargs="*", help="specific TMDB ids")
    ap.add_argument("--refresh", action="store_true", help="re-warm already-warmed films")
    args = ap.parse_args()

    async with async_session() as session:
        films = await _seeds(session, args.limit, args.tmdb, args.refresh)
        if not films:
            logger.info("Nothing to warm. Seed the catalog first, or pass --refresh.")
            return

        logger.info("Warming %d film(s)", len(films))
        for film in films:
            seed = {
                "tmdbId": film.tmdb_id,
                "title": film.title,
                "year": (film.release_date or "")[:4] or None,
                "genres": [g.get("name") for g in (film.genres or []) if g.get("name")],
                "original_language": film.original_language,
            }
            try:
                pool = await pipeline.build_pool(session, seed)
                await session.commit()
                logger.info("  %-40s → %d candidates", film.title[:40], len(pool))
            except Exception as exc:  # noqa: BLE001 - one bad seed must not stop the run
                await session.rollback()
                logger.warning("  %-40s → failed: %s", film.title[:40], exc)

        total = (
            await session.execute(
                select(func.count(func.distinct(DiscoveryEvidence.seed_tmdb_id)))
            )
        ).scalar_one()
        logger.info("Done. %d film(s) now have a warm pool.", total)


if __name__ == "__main__":
    asyncio.run(main())
