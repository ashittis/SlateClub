"""Hand-curated demo seed (no TMDB required).

Inserts 8 well-chosen films directly into the `movies` table so the
affect-extraction + anchor endpoint can be tested without network access
to TMDB. The films are deliberately picked to exercise the affect rubric:

  - The Social Network + Uncut Gems share zero genre/director/cast but
    identical affect (relentless propulsion, escalating loss of control).
  - Burning + Parasite + There Will Be Blood test the slow-burn /
    atmospheric / dread axes.
  - Whiplash + Oldboy test high tension / abrasive texture.
  - Lost in Translation tests low tension, intimate, tender — the
    opposite corner of affect space, so the centroid math is exercised.

Run from backend/:

    python -m scripts.seed_demo
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Import every model module so SQLAlchemy resolves string-named relationships.
from app.models import (  # noqa: F401
    user, movie, actions, social, onboarding, taste_engine, slates,
    discourse, notifications, artists, releases, cultural, festivals,
    theatres, watch_parties, circles, chapters,
)
from app.models.movie import Movie


# tmdb_id chosen to be the real TMDB IDs so future TMDB syncs idempotently
# update these rows instead of duplicating them.
DEMO_FILMS: list[dict] = [
    {
        "tmdb_id": 37799,
        "title": "The Social Network",
        "overview": (
            "On a fall night in 2003, Harvard undergrad and computer programming "
            "genius Mark Zuckerberg sits down at his computer and heatedly begins "
            "working on a new idea. In a fury of blogging and programming, what "
            "begins in his dorm room soon becomes a global social network and a "
            "revolution in communication. A mere six years and 500 million friends "
            "later, Mark Zuckerberg is the youngest billionaire in history, but for "
            "this entrepreneur, success leads to both personal and legal complications."
        ),
        "release_date": "2010-10-01",
        "runtime": 121,
        "original_language": "en",
        "vote_average": 7.4,
        "popularity": 35.0,
        "genres": [{"id": 18, "name": "Drama"}, {"id": 36, "name": "History"}],
        "credits": {
            "director": {"id": 7467, "name": "David Fincher"},
            "cast": [
                {"id": 56365, "name": "Jesse Eisenberg"},
                {"id": 74568, "name": "Andrew Garfield"},
                {"id": 1117313, "name": "Justin Timberlake"},
                {"id": 220, "name": "Armie Hammer"},
            ],
        },
    },
    {
        "tmdb_id": 484247,
        "title": "Uncut Gems",
        "overview": (
            "A charismatic New York City jeweler always on the lookout for the next "
            "big score makes a series of high-stakes bets that could lead to the "
            "windfall of a lifetime. Howard must perform a precarious high-wire act, "
            "balancing business, family, and encroaching adversaries on all sides, in "
            "his relentless pursuit of the ultimate win."
        ),
        "release_date": "2019-12-13",
        "runtime": 135,
        "original_language": "en",
        "vote_average": 7.0,
        "popularity": 30.0,
        "genres": [
            {"id": 80, "name": "Crime"},
            {"id": 18, "name": "Drama"},
            {"id": 53, "name": "Thriller"},
        ],
        "credits": {
            "director": {"id": 1023325, "name": "Josh Safdie"},
            "cast": [
                {"id": 19274, "name": "Adam Sandler"},
                {"id": 1620281, "name": "Julia Fox"},
                {"id": 235189, "name": "LaKeith Stanfield"},
                {"id": 1216314, "name": "Kevin Garnett"},
            ],
        },
    },
    {
        "tmdb_id": 491584,
        "title": "Burning",
        "overview": (
            "Deliveryman Jongsu is out on a job when he runs into Haemi, a girl who "
            "once lived in his neighborhood. She asks if he'd mind looking after her "
            "cat while she's away on a trip to Africa. On her return, Haemi introduces "
            "Jongsu to Ben, a mysterious wealthy young man she met during her travels. "
            "One day, Ben confides his most peculiar hobby to Jongsu."
        ),
        "release_date": "2018-05-17",
        "runtime": 148,
        "original_language": "ko",
        "vote_average": 7.5,
        "popularity": 12.0,
        "genres": [{"id": 18, "name": "Drama"}, {"id": 9648, "name": "Mystery"}],
        "credits": {
            "director": {"id": 21684, "name": "Lee Chang-dong"},
            "cast": [
                {"id": 1342588, "name": "Yoo Ah-in"},
                {"id": 1373737, "name": "Steven Yeun"},
                {"id": 1734300, "name": "Jeon Jong-seo"},
            ],
        },
    },
    {
        "tmdb_id": 496243,
        "title": "Parasite",
        "overview": (
            "All unemployed, Ki-taek's family takes peculiar interest in the wealthy "
            "and glamorous Parks for their livelihood until they get entangled in an "
            "unexpected incident."
        ),
        "release_date": "2019-05-30",
        "runtime": 132,
        "original_language": "ko",
        "vote_average": 8.5,
        "popularity": 90.0,
        "genres": [
            {"id": 35, "name": "Comedy"},
            {"id": 53, "name": "Thriller"},
            {"id": 18, "name": "Drama"},
        ],
        "credits": {
            "director": {"id": 21684, "name": "Bong Joon-ho"},
            "cast": [
                {"id": 20738, "name": "Song Kang-ho"},
                {"id": 1294743, "name": "Lee Sun-kyun"},
                {"id": 1268147, "name": "Cho Yeo-jeong"},
                {"id": 232890, "name": "Choi Woo-shik"},
            ],
        },
    },
    {
        "tmdb_id": 670,
        "title": "Oldboy",
        "overview": (
            "With no clue how he came to be imprisoned, drugged and tortured for 15 "
            "years, a desperate businessman seeks vengeance on his captors."
        ),
        "release_date": "2003-11-21",
        "runtime": 120,
        "original_language": "ko",
        "vote_average": 8.0,
        "popularity": 25.0,
        "genres": [
            {"id": 28, "name": "Action"},
            {"id": 18, "name": "Drama"},
            {"id": 9648, "name": "Mystery"},
            {"id": 53, "name": "Thriller"},
        ],
        "credits": {
            "director": {"id": 14756, "name": "Park Chan-wook"},
            "cast": [
                {"id": 70851, "name": "Choi Min-sik"},
                {"id": 71728, "name": "Yoo Ji-tae"},
                {"id": 70853, "name": "Kang Hye-jung"},
            ],
        },
    },
    {
        "tmdb_id": 7345,
        "title": "There Will Be Blood",
        "overview": (
            "Ruthless silver miner, turned oil prospector, Daniel Plainview, moves to "
            "oil-rich California. Using his son to project a trustworthy, family-man "
            "image, Plainview cons local landowners into selling him their valuable "
            "properties for a pittance. However, local preacher Eli Sunday suspects "
            "Plainview's motives and intentions, starting a slow-burning feud that "
            "threatens both their lives."
        ),
        "release_date": "2007-12-26",
        "runtime": 158,
        "original_language": "en",
        "vote_average": 8.1,
        "popularity": 18.0,
        "genres": [{"id": 18, "name": "Drama"}],
        "credits": {
            "director": {"id": 4762, "name": "Paul Thomas Anderson"},
            "cast": [
                {"id": 5294, "name": "Daniel Day-Lewis"},
                {"id": 19278, "name": "Paul Dano"},
                {"id": 17697, "name": "Kevin J. O'Connor"},
            ],
        },
    },
    {
        "tmdb_id": 244786,
        "title": "Whiplash",
        "overview": (
            "Under the direction of a ruthless instructor, a talented young drummer "
            "begins to pursue perfection at any cost, even his humanity."
        ),
        "release_date": "2014-10-10",
        "runtime": 105,
        "original_language": "en",
        "vote_average": 8.4,
        "popularity": 50.0,
        "genres": [{"id": 18, "name": "Drama"}, {"id": 10402, "name": "Music"}],
        "credits": {
            "director": {"id": 1190668, "name": "Damien Chazelle"},
            "cast": [
                {"id": 2231, "name": "Miles Teller"},
                {"id": 2295, "name": "J.K. Simmons"},
                {"id": 1646055, "name": "Melissa Benoist"},
            ],
        },
    },
    {
        "tmdb_id": 153,
        "title": "Lost in Translation",
        "overview": (
            "Two lost souls visiting Tokyo — the young, neglected wife of a "
            "photographer and a washed-up movie star shooting a TV commercial — "
            "find an odd solace and pensive freedom to be real in each other's "
            "company, away from their lives in America."
        ),
        "release_date": "2003-09-12",
        "runtime": 101,
        "original_language": "en",
        "vote_average": 7.4,
        "popularity": 16.0,
        "genres": [{"id": 18, "name": "Drama"}, {"id": 10749, "name": "Romance"}],
        "credits": {
            "director": {"id": 1776, "name": "Sofia Coppola"},
            "cast": [
                {"id": 1532, "name": "Bill Murray"},
                {"id": 2226, "name": "Scarlett Johansson"},
                {"id": 11827, "name": "Giovanni Ribisi"},
            ],
        },
    },
]


async def _upsert(db: AsyncSession, data: dict) -> bool:
    tmdb_id = data.pop("tmdb_id")
    existing = (
        await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    ).scalar_one_or_none()
    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        return False
    db.add(Movie(tmdb_id=tmdb_id, **data))
    return True


async def run() -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    inserted = updated = 0
    async with Session() as db:
        for film in DEMO_FILMS:
            was_new = await _upsert(db, dict(film))
            inserted += int(was_new)
            updated += int(not was_new)
        await db.commit()
    print(f"[demo-seed] done. new={inserted} updated={updated} total={len(DEMO_FILMS)}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
