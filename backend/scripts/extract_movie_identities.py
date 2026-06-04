"""Offline batch extractor — populates MovieIdentity for every movie
in the catalog that doesn't have one yet.

Run from backend/:

    python -m scripts.extract_movie_identities                  # all pending
    python -m scripts.extract_movie_identities --limit 50       # smoke test
    python -m scripts.extract_movie_identities --refresh-older-than 90
                                                                # re-extract
                                                                # entries
                                                                # older than
                                                                # 90 days

Idempotent: skips movies that already have an identity unless
--refresh-older-than is given.

Cost note: each movie ≈ 1 LLM call (~3k tokens) + 1 embedding call.
With gpt-5.5 + text-embedding-3-large this runs ~$0.01–$0.03/movie at
list pricing. Adjust OPENAI_LLM_MODEL/EMBED_MODEL in .env to control cost.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.ml.llm import openai_client as llm
from app.ml.llm.movie_identity import extract_and_embed, now_utc

# Import every model module so SQLAlchemy can resolve string-named
# relationships (e.g. Movie -> Rating) when it compiles the first query.
from app.models import (  # noqa: F401
    user,
    movie,
    actions,
    social,
    onboarding,
    taste_engine,
    slates,
    discourse,
    notifications,
    artists,
    releases,
    cultural,
    festivals,
    theatres,
    watch_parties,
    circles,
    chapters,
)
from app.models.movie import Movie


def _movie_to_input(m: Movie) -> dict:
    """Shape a Movie row into the dict the extractor expects."""
    return {
        "title": m.title,
        "overview": m.overview,
        "release_date": m.release_date,
        "runtime": m.runtime,
        "original_language": m.original_language,
        "genres": m.genres,
        "credits": m.credits,
    }


async def _process_one(session: AsyncSession, movie: Movie) -> bool:
    """Run extraction for one movie and persist. Returns True on success."""
    identity, embedding_bytes = await extract_and_embed(_movie_to_input(movie))
    if identity is None:
        return False

    movie.identity_json = identity
    movie.identity_embedding = embedding_bytes
    movie.identity_updated_at = now_utc()
    await session.flush()
    return True


async def run(*, limit: int | None, refresh_older_than: int | None) -> None:
    if not llm.is_available():
        print("[extract] OPENAI_API_KEY is not set — aborting.")
        return

    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        stmt = select(Movie)
        if refresh_older_than is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(days=refresh_older_than)
            stmt = stmt.where(
                (Movie.identity_updated_at.is_(None))
                | (Movie.identity_updated_at < cutoff)
            )
        else:
            stmt = stmt.where(Movie.identity_json.is_(None))
        if limit:
            stmt = stmt.limit(limit)

        movies = (await session.execute(stmt)).scalars().all()
        total = len(movies)
        print(f"[extract] {total} movies to process")

        ok = fail = 0
        for i, m in enumerate(movies, start=1):
            try:
                success = await _process_one(session, m)
            except Exception as exc:
                print(f"[extract] {m.title!r}: unexpected error: {exc}")
                success = False
            if success:
                ok += 1
            else:
                fail += 1

            if i % 10 == 0:
                await session.commit()
                print(f"[extract] {i}/{total}  ok={ok} fail={fail}")

        await session.commit()
        print(f"[extract] done. ok={ok} fail={fail}")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Cap the number of movies processed (smoke test).",
    )
    parser.add_argument(
        "--refresh-older-than", type=int, default=None,
        help="Re-extract identities older than N days (default: only "
             "extract movies with no identity yet).",
    )
    args = parser.parse_args()
    asyncio.run(
        run(limit=args.limit, refresh_older_than=args.refresh_older_than)
    )


if __name__ == "__main__":
    main()
