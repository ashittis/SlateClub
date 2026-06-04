"""One-shot TMDB catalog seeder.

Pulls the top-N popular films from TMDB and upserts them into the `movies`
table so the affect-extraction script has something to chew on. Idempotent
— re-running just refreshes the fields.

Run from backend/:

    python -m scripts.seed_catalog               # default 30 movies
    python -m scripts.seed_catalog --limit 100   # more
    python -m scripts.seed_catalog --pages 3     # 60 movies (TMDB page = 20)
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.integrations import tmdb

# Import every model module so SQLAlchemy resolves string-named relationships.
from app.models import (  # noqa: F401
    user, movie, actions, social, onboarding, taste_engine, slates,
    discourse, notifications, artists, releases, cultural, festivals,
    theatres, watch_parties, circles, chapters,
)
from app.models.movie import Movie


async def _upsert(db: AsyncSession, data: dict) -> bool:
    """Insert or update a movie row. Returns True if it was new."""
    tmdb_id = data.get("id") or data.get("tmdb_id")
    if not tmdb_id:
        return False
    existing = (
        await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    ).scalar_one_or_none()
    fields = dict(
        title=data.get("title", ""),
        overview=data.get("overview"),
        poster_path=data.get("poster_path"),
        backdrop_path=data.get("backdrop_path"),
        release_date=data.get("release_date"),
        runtime=data.get("runtime"),
        vote_average=data.get("vote_average"),
        vote_count=data.get("vote_count"),
        popularity=data.get("popularity"),
        original_language=data.get("original_language"),
        genres=data.get("genres"),
        credits=data.get("credits"),
    )
    if existing:
        for k, v in fields.items():
            if v is not None:
                setattr(existing, k, v)
        return False
    db.add(Movie(tmdb_id=tmdb_id, **fields))
    return True


async def run(*, limit: int, pages: int) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    inserted = updated = 0
    async with Session() as db:
        for page in range(1, pages + 1):
            popular = await tmdb.get_popular_movies(page)
            for stub in popular.get("results", []):
                tmdb_id = stub.get("id")
                if not tmdb_id:
                    continue
                # Full details + credits give us runtime, original_language, cast/director.
                try:
                    detail = await tmdb.get_movie(tmdb_id)
                    credits = await tmdb.get_movie_credits(tmdb_id)
                    detail["credits"] = credits
                except Exception as exc:
                    print(f"[seed] tmdb fetch failed for {tmdb_id}: {exc}")
                    continue
                was_new = await _upsert(db, detail)
                inserted += int(was_new)
                updated += int(not was_new)
                if inserted + updated >= limit:
                    break
            if inserted + updated >= limit:
                break
            await db.commit()
            print(f"[seed] page {page}: {inserted} new, {updated} updated")
        await db.commit()
    print(f"[seed] done. new={inserted} updated={updated}")
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--pages", type=int, default=2)
    args = parser.parse_args()
    asyncio.run(run(limit=args.limit, pages=args.pages))


if __name__ == "__main__":
    main()
