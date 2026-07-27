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
from app import models_registry  # noqa: F401
from app.shared.models.movie import Movie


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


async def _ingest_stub(db: AsyncSession, tmdb_id: int) -> bool | None:
    """Fetch full detail + credits for a TMDB id and upsert. Returns
    True=new, False=updated, None=fetch failed."""
    try:
        detail = await tmdb.get_movie(tmdb_id)
        credits = await tmdb.get_movie_credits(tmdb_id)
        detail["credits"] = credits
    except Exception as exc:
        print(f"[seed] tmdb fetch failed for {tmdb_id}: {exc}")
        return None
    return await _upsert(db, detail)


async def run(*, limit: int, pages: int, languages: list[str] | None, per_lang: int) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    inserted = updated = 0
    async with Session() as db:
        if languages:
            # Balanced multi-language seed: top films per language via discover.
            for lang in languages:
                got = 0
                for page in range(1, pages + 1):
                    if got >= per_lang:
                        break
                    try:
                        resp = await tmdb.discover_movies(
                            {
                                "with_original_language": lang,
                                "sort_by": "popularity.desc",
                                "vote_count.gte": 50,
                                "page": page,
                            }
                        )
                    except Exception as exc:
                        print(f"[seed] discover failed for lang={lang}: {exc}")
                        break
                    for stub in resp.get("results", []):
                        tmdb_id = stub.get("id")
                        if not tmdb_id:
                            continue
                        was_new = await _ingest_stub(db, tmdb_id)
                        if was_new is None:
                            continue
                        inserted += int(was_new)
                        updated += int(not was_new)
                        got += 1
                        if got >= per_lang:
                            break
                    await db.commit()
                print(f"[seed] {lang}: {got} films ingested")
        else:
            for page in range(1, pages + 1):
                popular = await tmdb.get_popular_movies(page)
                for stub in popular.get("results", []):
                    tmdb_id = stub.get("id")
                    if not tmdb_id:
                        continue
                    was_new = await _ingest_stub(db, tmdb_id)
                    if was_new is None:
                        continue
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
    parser.add_argument(
        "--languages",
        type=str,
        nargs="+",
        default=None,
        help="ISO-639-1 codes to seed per-language (e.g. en hi ko ja ta te ml). "
        "When omitted, pulls global /movie/popular.",
    )
    parser.add_argument(
        "--per-lang",
        type=int,
        default=40,
        help="Target films per language when --languages is given.",
    )
    args = parser.parse_args()
    asyncio.run(
        run(
            limit=args.limit,
            pages=args.pages,
            languages=args.languages,
            per_lang=args.per_lang,
        )
    )


if __name__ == "__main__":
    main()
