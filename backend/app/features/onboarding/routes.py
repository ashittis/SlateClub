import asyncio
import json
import random
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.shared.models.onboarding import (
    FavoriteMovie,
    FavoritePerson,
    LanguageSelection,
    OnboardingSignals,
)
from app.shared.models.user import User

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _map_tmdb_people(results: list[dict]) -> list[dict]:
    """Map TMDB person results to the camelCase shape the frontend expects."""
    return [
        {
            "tmdbId": p["id"],
            "name": p.get("name", ""),
            "profilePath": p.get("profile_path"),
            "knownFor": p.get("known_for_department", "Acting"),
            "popularity": p.get("popularity", 0),
        }
        for p in results
        if p.get("id")
    ]


def _map_tmdb_movies(results: list[dict]) -> list[dict]:
    """Map TMDB movie results to the camelCase shape the frontend expects."""
    return [
        {
            "tmdbId": m["id"],
            "title": m.get("title", ""),
            "posterPath": m.get("poster_path"),
            "releaseDate": m.get("release_date"),
            "voteAverage": m.get("vote_average", 0),
        }
        for m in results
        if m.get("id")
    ]


FALLBACK_MOVIES = [
    {"tmdbId": 27205,  "title": "Inception",                  "posterPath": None, "releaseDate": "2010-07-16", "voteAverage": 8.4},
    {"tmdbId": 155,    "title": "The Dark Knight",            "posterPath": None, "releaseDate": "2008-07-18", "voteAverage": 8.5},
    {"tmdbId": 238,    "title": "The Godfather",              "posterPath": None, "releaseDate": "1972-03-14", "voteAverage": 8.7},
    {"tmdbId": 278,    "title": "The Shawshank Redemption",   "posterPath": None, "releaseDate": "1994-09-23", "voteAverage": 8.7},
    {"tmdbId": 680,    "title": "Pulp Fiction",               "posterPath": None, "releaseDate": "1994-09-10", "voteAverage": 8.5},
    {"tmdbId": 13,     "title": "Forrest Gump",               "posterPath": None, "releaseDate": "1994-06-23", "voteAverage": 8.5},
    {"tmdbId": 550,    "title": "Fight Club",                 "posterPath": None, "releaseDate": "1999-10-15", "voteAverage": 8.4},
    {"tmdbId": 11,     "title": "Star Wars",                  "posterPath": None, "releaseDate": "1977-05-25", "voteAverage": 8.2},
    {"tmdbId": 120,    "title": "The Lord of the Rings: The Fellowship of the Ring", "posterPath": None, "releaseDate": "2001-12-18", "voteAverage": 8.4},
    {"tmdbId": 603,    "title": "The Matrix",                 "posterPath": None, "releaseDate": "1999-03-30", "voteAverage": 8.2},
    {"tmdbId": 157336, "title": "Interstellar",               "posterPath": None, "releaseDate": "2014-11-05", "voteAverage": 8.4},
    {"tmdbId": 769,    "title": "GoodFellas",                 "posterPath": None, "releaseDate": "1990-09-12", "voteAverage": 8.5},
    {"tmdbId": 429617, "title": "Spider-Man: Far From Home",  "posterPath": None, "releaseDate": "2019-06-28", "voteAverage": 7.5},
    {"tmdbId": 299536, "title": "Avengers: Infinity War",     "posterPath": None, "releaseDate": "2018-04-25", "voteAverage": 8.3},
    {"tmdbId": 19404,  "title": "Dilwale Dulhania Le Jayenge","posterPath": None, "releaseDate": "1995-10-20", "voteAverage": 8.0},
    {"tmdbId": 20453,  "title": "3 Idiots",                   "posterPath": None, "releaseDate": "2009-12-25", "voteAverage": 8.2},
    {"tmdbId": 346698, "title": "Barbie",                     "posterPath": None, "releaseDate": "2023-07-19", "voteAverage": 7.0},
    {"tmdbId": 872585, "title": "Oppenheimer",                "posterPath": None, "releaseDate": "2023-07-19", "voteAverage": 8.1},
]


FALLBACK_PEOPLE = [
    {"tmdbId": 525,    "name": "Christopher Nolan",    "profilePath": None, "knownFor": "Directing",  "popularity": 40},
    {"tmdbId": 17419,  "name": "Bryan Cranston",       "profilePath": None, "knownFor": "Acting",     "popularity": 38},
    {"tmdbId": 500,    "name": "Tom Cruise",           "profilePath": None, "knownFor": "Acting",     "popularity": 55},
    {"tmdbId": 6193,   "name": "Leonardo DiCaprio",    "profilePath": None, "knownFor": "Acting",     "popularity": 50},
    {"tmdbId": 1136406,"name": "Tom Holland",          "profilePath": None, "knownFor": "Acting",     "popularity": 60},
    {"tmdbId": 172069, "name": "Cillian Murphy",       "profilePath": None, "knownFor": "Acting",     "popularity": 45},
    {"tmdbId": 73457,  "name": "Chris Hemsworth",      "profilePath": None, "knownFor": "Acting",     "popularity": 44},
    {"tmdbId": 1245,   "name": "Scarlett Johansson",   "profilePath": None, "knownFor": "Acting",     "popularity": 48},
    {"tmdbId": 17276,  "name": "Brad Pitt",            "profilePath": None, "knownFor": "Acting",     "popularity": 42},
    {"tmdbId": 974169, "name": "Jenna Ortega",         "profilePath": None, "knownFor": "Acting",     "popularity": 52},
    {"tmdbId": 10859,  "name": "Ryan Reynolds",        "profilePath": None, "knownFor": "Acting",     "popularity": 47},
    {"tmdbId": 380,    "name": "Robert De Niro",       "profilePath": None, "knownFor": "Acting",     "popularity": 35},
    {"tmdbId": 488,    "name": "Steven Spielberg",     "profilePath": None, "knownFor": "Directing",  "popularity": 36},
    {"tmdbId": 138,    "name": "Quentin Tarantino",    "profilePath": None, "knownFor": "Directing",  "popularity": 34},
    {"tmdbId": 7467,   "name": "Martin Scorsese",      "profilePath": None, "knownFor": "Directing",  "popularity": 33},
    {"tmdbId": 17200,  "name": "Shah Rukh Khan",       "profilePath": None, "knownFor": "Acting",     "popularity": 40},
    {"tmdbId": 85,     "name": "Johnny Depp",          "profilePath": None, "knownFor": "Acting",     "popularity": 41},
    {"tmdbId": 1100,   "name": "Arnold Schwarzenegger","profilePath": None, "knownFor": "Acting",     "popularity": 30},
]


# ── Schemas ──────────────────────────────────────────────────

class LanguagesRequest(BaseModel):
    languages: list[str]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PersonItem(CamelModel):
    tmdb_id: int
    name: str
    profile_path: str | None = None
    known_for: str


class PeopleSaveRequest(BaseModel):
    people: list[PersonItem]


class MovieItem(CamelModel):
    tmdb_id: int
    title: str
    poster_path: str | None = None


class MoviesSaveRequest(BaseModel):
    movies: list[MovieItem]


class PostersSaveRequest(BaseModel):
    tmdb_ids: list[int] = Field(alias="tmdbIds")
    model_config = ConfigDict(populate_by_name=True)


class MoodSaveRequest(BaseModel):
    pacing: float = Field(ge=-1.0, le=1.0)
    tone: float = Field(ge=-1.0, le=1.0)
    realism: float = Field(ge=-1.0, le=1.0)


class PlatformsSaveRequest(BaseModel):
    platforms: list[str]
    prefers_theatres: bool = Field(default=False, alias="prefersTheatres")
    model_config = ConfigDict(populate_by_name=True)


class OriginSaveRequest(BaseModel):
    tmdb_id: int = Field(alias="tmdbId")
    model_config = ConfigDict(populate_by_name=True)


# ── Helpers ──────────────────────────────────────────────────

_POSTER_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "poster_gut_test_seed.json"
_poster_seed_cache: list[dict] | None = None


def _load_poster_seed() -> list[dict]:
    global _poster_seed_cache
    if _poster_seed_cache is None:
        with open(_POSTER_SEED_PATH, "r", encoding="utf-8") as f:
            _poster_seed_cache = json.load(f).get("posters", [])
    return _poster_seed_cache


# The curated seed only stores tmdb_id/title, so poster paths are hydrated from
# TMDB on demand and memoised process-wide (the seed is small + static).
_poster_path_memo: dict[int, str | None] = {}


async def _hydrate_poster_paths(tmdb_ids: list[int]) -> None:
    missing = [t for t in tmdb_ids if t not in _poster_path_memo]
    if not missing:
        return

    async def _one(tid: int) -> tuple[int, str | None]:
        try:
            data = await tmdb.get_movie(tid)
            return tid, (data or {}).get("poster_path")
        except Exception:
            return tid, None

    for tid, pp in await asyncio.gather(*(_one(t) for t in missing)):
        _poster_path_memo[tid] = pp


async def _get_or_create_signals(
    user_id: str, db: AsyncSession
) -> OnboardingSignals:
    result = await db.execute(
        select(OnboardingSignals).where(OnboardingSignals.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = OnboardingSignals(user_id=user_id)
        db.add(row)
        await db.flush()
    return row


# ── Routes ───────────────────────────────────────────────────

@router.post("/languages")
async def save_languages(
    body: LanguagesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Replace existing selections
    await db.execute(delete(LanguageSelection).where(LanguageSelection.user_id == user.id))

    for lang in body.languages:
        db.add(LanguageSelection(user_id=user.id, language=lang))

    await db.flush()
    return {"ok": True, "count": len(body.languages)}


@router.get("/people/search")
async def search_people(q: str | None = None, page: int = 1):
    try:
        if q and q.strip():
            data = await tmdb.search_people(q.strip(), page)
            people = _map_tmdb_people(data.get("results", []))
        else:
            # Rotate the popular pool so the grid varies each visit (TMDB's
            # /person/popular page 1 is identical every time otherwise).
            data = await tmdb.get_popular_people(random.randint(1, 8))
            results = [r for r in data.get("results", []) if r.get("profile_path")]
            random.shuffle(results)
            people = _map_tmdb_people(results)
    except Exception:
        # Fallback when TMDB is unreachable
        people = FALLBACK_PEOPLE
    return {"people": people}


@router.post("/people")
async def save_people(
    body: PeopleSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Replace existing
    await db.execute(delete(FavoritePerson).where(FavoritePerson.user_id == user.id))

    for p in body.people:
        db.add(
            FavoritePerson(
                user_id=user.id,
                tmdb_id=p.tmdb_id,
                name=p.name,
                profile_path=p.profile_path,
                known_for=p.known_for,
            )
        )

    await db.flush()
    return {"ok": True, "count": len(body.people)}


@router.get("/movies/search")
async def search_movies_for_onboarding(
    q: str | None = None,
    page: int = 1,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        if q:
            data = await tmdb.search_movies(q, page)
            movies = _map_tmdb_movies(data.get("results", []))
            return {"movies": movies}

        # If no query, get movies from user's favorite people
        result = await db.execute(
            select(FavoritePerson).where(FavoritePerson.user_id == user.id)
        )
        people = result.scalars().all()
        if not people:
            data = await tmdb.get_popular_movies(page)
            movies = _map_tmdb_movies(data.get("results", []))
            return {"movies": movies}

        all_movies = []
        seen_ids: set[int] = set()
        for person in people:
            credits = await tmdb.get_person_movie_credits(person.tmdb_id)
            for movie in credits.get("cast", [])[:5]:
                mid = movie.get("id")
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    all_movies.append(movie)

        all_movies.sort(key=lambda m: m.get("popularity", 0), reverse=True)
        movies = _map_tmdb_movies(all_movies[:20])
        return {"movies": movies}
    except Exception:
        return {"movies": FALLBACK_MOVIES}


@router.post("/movies")
async def save_movies(
    body: MoviesSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Replace existing
    await db.execute(delete(FavoriteMovie).where(FavoriteMovie.user_id == user.id))

    for m in body.movies:
        db.add(
            FavoriteMovie(
                user_id=user.id,
                tmdb_id=m.tmdb_id,
                title=m.title,
                poster_path=m.poster_path,
            )
        )

    # Mark user as onboarded
    user.onboarded = True
    await db.flush()
    return {"ok": True, "count": len(body.movies)}


@router.get("/status")
async def onboarding_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    languages = (
        await db.execute(
            select(LanguageSelection).where(LanguageSelection.user_id == user.id)
        )
    ).scalars().all()

    people = (
        await db.execute(
            select(FavoritePerson).where(FavoritePerson.user_id == user.id)
        )
    ).scalars().all()

    movies = (
        await db.execute(
            select(FavoriteMovie).where(FavoriteMovie.user_id == user.id)
        )
    ).scalars().all()

    return {
        "onboarded": user.onboarded,
        "languages_selected": len(languages) > 0,
        "languages_count": len(languages),
        "people_selected": len(people) > 0,
        "people_count": len(people),
        "movies_selected": len(movies) > 0,
        "movies_count": len(movies),
    }


# ── 8-step "Tune Your Taste" — extended signals ────────────


@router.get("/posters/set")
async def get_poster_set(count: int = 18):
    """
    Returns a randomised slice of the curated Poster Gut Test set.
    Two users see different posters in different orders so the
    test reads as visual instinct rather than a quiz.
    """
    seed = _load_poster_seed()
    n = max(6, min(count, len(seed)))
    sample = random.sample(seed, n)
    # Seed stores only tmdb_id/title — hydrate real poster paths from TMDB.
    await _hydrate_poster_paths([p["tmdb_id"] for p in sample])
    # Strip the hidden mood/aesthetic tags before returning — the
    # frontend never needs them; they exist only on the backend.
    posters = [
        {
            "tmdbId": p["tmdb_id"],
            "posterPath": p.get("poster_path") or _poster_path_memo.get(p["tmdb_id"]),
            "title": p.get("title"),
        }
        for p in sample
    ]
    return {"posters": posters}


@router.post("/posters")
async def save_posters(
    body: PostersSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.tmdb_ids) < 1:
        raise HTTPException(status_code=400, detail="Pick at least 1 poster")
    signals = await _get_or_create_signals(user.id, db)
    signals.poster_picks = body.tmdb_ids
    await db.flush()
    return {"ok": True, "count": len(body.tmdb_ids)}


@router.post("/mood")
async def save_mood(
    body: MoodSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signals = await _get_or_create_signals(user.id, db)
    signals.mood_pacing = body.pacing
    signals.mood_tone = body.tone
    signals.mood_realism = body.realism
    await db.flush()
    return {"ok": True}


@router.post("/platforms")
async def save_platforms(
    body: PlatformsSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signals = await _get_or_create_signals(user.id, db)
    signals.platforms = body.platforms
    signals.prefers_theatres = body.prefers_theatres
    await db.flush()
    return {"ok": True, "count": len(body.platforms)}


@router.post("/origin")
async def save_origin(
    body: OriginSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signals = await _get_or_create_signals(user.id, db)
    signals.origin_film_tmdb_id = body.tmdb_id
    await db.flush()
    return {"ok": True}


@router.post("/welcome")
async def mark_welcomed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signals = await _get_or_create_signals(user.id, db)
    if signals.welcomed_at is None:
        signals.welcomed_at = datetime.now(timezone.utc)
        await db.flush()
    return {"ok": True}


@router.get("/summary")
async def onboarding_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Powers the Step 8 "Taste Ready" reveal.
    Returns a count of films matched against the user's seeded
    taste, plus a count of twins currently watching them.
    The numbers are intentionally rough; the moment is emotional,
    not analytic.
    """
    signals_row = await db.execute(
        select(OnboardingSignals).where(OnboardingSignals.user_id == user.id)
    )
    signals = signals_row.scalar_one_or_none()
    poster_count = len(signals.poster_picks or []) if signals else 0
    platforms_count = len(signals.platforms or []) if signals else 0
    languages = (
        await db.execute(
            select(LanguageSelection).where(LanguageSelection.user_id == user.id)
        )
    ).scalars().all()
    favourites = (
        await db.execute(
            select(FavoriteMovie).where(FavoriteMovie.user_id == user.id)
        )
    ).scalars().all()

    # Heuristic match count: 7 per language, 4 per favourite, 3 per poster
    # pick. Capped to 250. Replace once the recommendation pipeline can
    # cheaply estimate cardinality from a seeded vector.
    match_count = min(
        250,
        len(languages) * 7
        + len(favourites) * 4
        + poster_count * 3
        + platforms_count * 2,
    )

    # Twins count is a teaser. Pull a small sample of recent watches by
    # other users overlapping on language; cap at 12.
    twins_watching = min(12, max(2, len(languages) * 2 + len(favourites)))

    sample_posters = [
        {"tmdbId": fav.tmdb_id, "posterPath": fav.poster_path, "title": fav.title}
        for fav in favourites[:4]
    ]

    if signals is not None and signals.ready_shown_at is None:
        signals.ready_shown_at = datetime.now(timezone.utc)
        await db.flush()

    return {
        "matchedFilmCount": match_count,
        "twinsWatchingCount": twins_watching,
        "samplePosters": sample_posters,
    }
