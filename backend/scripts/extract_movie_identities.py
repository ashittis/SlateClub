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
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.ml.llm import openai_client as llm
from app.ml.llm.movie_identity import extract_and_embed, now_utc
from app.shared.services.reddit_enrich import get_or_fetch_discussion

# Import every model module so SQLAlchemy can resolve string-named
# relationships (e.g. Movie -> Rating) when it compiles the first query.
from app import models_registry  # noqa: F401
from app.shared.models.movie import Movie


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


async def _safe_extract(movie_input: dict, external_text: str):
    """extract_and_embed but never raises — one failure returns (None, None)
    instead of cancelling the whole gather()."""
    try:
        return await extract_and_embed(movie_input, external_text=external_text)
    except Exception as exc:  # noqa: BLE001
        print(f"[extract] {movie_input.get('title')!r}: {exc}")
        return None, None


def _chunks(seq: list, n: int):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


async def run(
    *, limit: int | None, refresh_older_than: int | None,
    with_reddit: bool, concurrency: int,
) -> None:
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

        movies = list((await session.execute(stmt)).scalars().all())
        total = len(movies)
        print(f"[extract] {total} movies to process  (reddit={'on' if with_reddit else 'off'}, concurrency={concurrency})")

        ok = fail = done = 0
        # Process in chunks: resolve Reddit text sequentially (cache-fast), then
        # fan OUT the OpenAI extraction (network, no session), then fan IN the DB
        # writes sequentially — AsyncSession is not concurrency-safe.
        for chunk in _chunks(movies, max(1, concurrency)):
            texts: dict[str, str] = {}
            if with_reddit:
                for m in chunk:
                    year = (m.release_date or "")[:4] or None
                    texts[m.id] = await get_or_fetch_discussion(
                        session, m.tmdb_id, m.title or "", year, m.original_language
                    )

            results = await asyncio.gather(
                *(_safe_extract(_movie_to_input(m), texts.get(m.id, "")) for m in chunk)
            )

            for m, (identity, embedding_bytes) in zip(chunk, results):
                if identity is None:
                    fail += 1
                    continue
                m.identity_json = identity
                m.identity_embedding = embedding_bytes
                m.identity_updated_at = now_utc()
                ok += 1
            await session.flush()

            done += len(chunk)
            await session.commit()
            print(f"[extract] {done}/{total}  ok={ok} fail={fail}")

        print(f"[extract] done. ok={ok} fail={fail}")

    await engine.dispose()
    from app.integrations import reddit as _reddit
    await _reddit.aclose()


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
    parser.add_argument(
        "--with-reddit", action="store_true",
        help="Enrich each film's prompt with cached Reddit discussion "
             "(fetches live on a cache miss). Off by default — identical to "
             "the previous TMDB-only behaviour.",
    )
    parser.add_argument(
        "--concurrency", type=int, default=1,
        help="Concurrent OpenAI extractions per chunk (default 1). DB writes "
             "stay sequential; Reddit stays globally rate-limited.",
    )
    args = parser.parse_args()
    asyncio.run(
        run(
            limit=args.limit,
            refresh_older_than=args.refresh_older_than,
            with_reddit=args.with_reddit,
            concurrency=args.concurrency,
        )
    )


if __name__ == "__main__":
    main()
