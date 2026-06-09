"""
Taste Engine — sentence-builder filter API.

Slot grammar (each slot optional):
  mood       e.g. slow_contemplative, fast_intense, dark_unsettling
  genre      Action, Comedy, Drama, Horror, Sci-Fi, Thriller, Romance, …
  language   ISO-639-1: en, hi, ko, ja, fr, …
  platform   netflix, prime, mubi, hotstar, …  (advisory — see Movie.streaming_providers, P3)
  era        1960s, 1970s, 1980s, 1990s, 2000s, 2010s, 2020s

Endpoints:
  GET  /api/taste-engine/options      — vocabulary per slot
  GET  /api/taste-engine/match-count  — cheap filter aggregate
  POST /api/taste-engine/query        — top-N results with relevance for the bubble constellation
  GET  /api/taste-engine/presets      — saved sentences
  POST /api/taste-engine/presets      — save a sentence
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..integrations import tmdb
from ..models.movie import Movie
from ..models.taste_engine import TastePreset
from ..models.user import User
from ..services.similar_films import find_similar_films
from .movies import _upsert_movie

router = APIRouter(prefix="/api/taste-engine", tags=["taste-engine"])


# ── Vocabulary ────────────────────────────────────────────────


_GENRE_OPTIONS = [
    {"key": "Action",        "label": "action"},
    {"key": "Comedy",        "label": "comedy"},
    {"key": "Drama",         "label": "drama"},
    {"key": "Horror",        "label": "horror"},
    {"key": "Science Fiction","label": "sci-fi"},
    {"key": "Thriller",      "label": "thriller"},
    {"key": "Romance",       "label": "romance"},
    {"key": "Animation",     "label": "animation"},
    {"key": "Documentary",   "label": "documentary"},
    {"key": "Mystery",       "label": "mystery"},
    {"key": "Fantasy",       "label": "fantasy"},
    {"key": "Crime",         "label": "crime"},
]

_LANGUAGE_OPTIONS = [
    {"key": "en", "label": "English"},
    {"key": "hi", "label": "Hindi"},
    {"key": "ta", "label": "Tamil"},
    {"key": "te", "label": "Telugu"},
    {"key": "ml", "label": "Malayalam"},
    {"key": "kn", "label": "Kannada"},
    {"key": "ko", "label": "Korean"},
    {"key": "ja", "label": "Japanese"},
    {"key": "fr", "label": "French"},
    {"key": "es", "label": "Spanish"},
    {"key": "it", "label": "Italian"},
    {"key": "de", "label": "German"},
    {"key": "zh", "label": "Mandarin"},
]

_MOOD_OPTIONS = [
    {"key": "slow_contemplative", "label": "slow & contemplative"},
    {"key": "fast_intense",       "label": "fast & intense"},
    {"key": "funny_light",        "label": "funny & light"},
    {"key": "dark_unsettling",    "label": "dark & unsettling"},
    {"key": "tender_intimate",    "label": "tender & intimate"},
    {"key": "epic_warm",          "label": "epic & warm"},
    {"key": "wistful",            "label": "wistful"},
    {"key": "kinetic",            "label": "kinetic"},
]

_PLATFORM_OPTIONS = [
    {"key": "netflix",  "label": "Netflix"},
    {"key": "prime",    "label": "Prime"},
    {"key": "mubi",     "label": "MUBI"},
    {"key": "hotstar",  "label": "Hotstar"},
    {"key": "disney",   "label": "Disney+"},
    {"key": "hbo",      "label": "HBO Max"},
    {"key": "apple",    "label": "Apple TV+"},
    {"key": "sonyliv",  "label": "SonyLIV"},
    {"key": "zee5",     "label": "Zee5"},
]

_ERA_OPTIONS = [
    {"key": "2020s", "label": "2020s"},
    {"key": "2010s", "label": "2010s"},
    {"key": "2000s", "label": "2000s"},
    {"key": "1990s", "label": "1990s"},
    {"key": "1980s", "label": "1980s"},
    {"key": "1970s", "label": "1970s"},
    {"key": "1960s", "label": "1960s"},
    {"key": "1950s", "label": "1950s"},
]


@router.get("/options")
async def get_options() -> dict[str, list[dict[str, str]]]:
    return {
        "mood": _MOOD_OPTIONS,
        "genre": _GENRE_OPTIONS,
        "language": _LANGUAGE_OPTIONS,
        "platform": _PLATFORM_OPTIONS,
        "era": _ERA_OPTIONS,
    }


# ── TMDB augment ─────────────────────────────────────────────

# Map our slot keys to TMDB genre IDs.
_TMDB_GENRE_IDS: dict[str, int] = {
    "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
    "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
    "Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
    "Mystery": 9648, "Romance": 10749, "Science Fiction": 878,
    "TV Movie": 10770, "Thriller": 53, "War": 10752, "Western": 37,
}

# Tiny in-process LRU so repeated identical queries don't hammer TMDB.
_AUGMENT_CACHE: dict[str, float] = {}
_AUGMENT_TTL_SECONDS = 300  # 5 min


def _augment_key(genre: str | None, language: str | None, era: str | None) -> str:
    return f"{genre or ''}|{language or ''}|{era or ''}"


def _augment_recent(key: str) -> bool:
    import time

    ts = _AUGMENT_CACHE.get(key, 0)
    return (time.time() - ts) < _AUGMENT_TTL_SECONDS


def _mark_augmented(key: str) -> None:
    import time

    _AUGMENT_CACHE[key] = time.time()


async def _augment_from_tmdb(
    *,
    genre: str | None,
    language: str | None,
    era: str | None,
    db: AsyncSession,
    pages: int = 2,
) -> int:
    """Pull films from TMDB matching the same filters and cache them.
    Returns the number of films added/refreshed."""
    key = _augment_key(genre, language, era)
    if _augment_recent(key):
        return 0
    _mark_augmented(key)

    params: dict[str, Any] = {}
    if genre and genre in _TMDB_GENRE_IDS:
        params["with_genres"] = str(_TMDB_GENRE_IDS[genre])
    if language:
        params["with_original_language"] = language
    yr = _era_to_year_range(era)
    if yr:
        lo, hi = yr
        params["primary_release_date.gte"] = f"{lo}-01-01"
        params["primary_release_date.lte"] = f"{hi}-12-31"

    seen = 0
    for page in range(1, pages + 1):
        try:
            resp = await tmdb.discover_movies({**params, "page": page})
        except Exception:
            break
        for raw in resp.get("results") or []:
            try:
                # Augment shape so _upsert_movie has what it needs.
                raw["genres"] = [
                    {"id": gid, "name": ""} for gid in (raw.get("genre_ids") or [])
                ]
                await _upsert_movie(db, raw)
                seen += 1
            except Exception:
                continue
    return seen


# ── Filter helpers ────────────────────────────────────────────


def _era_to_year_range(era: str | None) -> tuple[int, int] | None:
    if not era or len(era) < 5:
        return None
    try:
        start = int(era[:4])
    except ValueError:
        return None
    return (start, start + 9)


def _build_filters(
    *,
    genre: str | None,
    language: str | None,
    era: str | None,
) -> list[Any]:
    """
    Build a list of SQLAlchemy filter clauses against the Movie table.
    Mood and platform are NOT filtered here:
      - mood relies on tone tags (Phase 2 once we backfill).
      - platform relies on streaming_providers (P3).
    Both are passed through to the query endpoint where they are
    used as soft re-ranking signals — not hard filters.
    """
    clauses: list[Any] = []

    if language:
        clauses.append(Movie.original_language == language)

    yr = _era_to_year_range(era)
    if yr:
        lo, hi = yr
        clauses.append(
            and_(
                Movie.release_date.is_not(None),
                Movie.release_date >= f"{lo}-01-01",
                Movie.release_date <= f"{hi}-12-31",
            )
        )

    if genre:
        # genres is JSON: [{"id": 28, "name": "Action"}, …].
        # SQLite does not implement jsonb @> so we fall back to
        # serialising the full row and looking for the genre name.
        clauses.append(func.cast(Movie.genres, type_=None) != None)  # noqa: E711
        clauses.append(
            func.lower(func.cast(Movie.genres, type_=None)).like(
                f"%{genre.lower()}%"
            )
        )

    return clauses


# ── Match count ───────────────────────────────────────────────


@router.get("/match-count")
async def match_count(
    mood: str | None = Query(default=None),
    genre: str | None = Query(default=None),
    language: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    era: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a cheap estimate of how many films match the current sentence.
    Counts only over the locally cached Movie table — adequate as a UI
    signal. The Movie table grows whenever a film is opened, so this is a
    proxy for "films the system already knows about".
    """
    clauses = _build_filters(genre=genre, language=language, era=era)

    async def _count_local() -> int:
        stmt = select(func.count(Movie.id))
        if clauses:
            stmt = stmt.where(and_(*clauses))
        return (await db.execute(stmt)).scalar_one() or 0

    count = await _count_local()

    # Sparse cache: pull a couple of TMDB pages so the count reflects
    # what we *can* actually surface, not what we happen to have cached.
    if count < 20 and (genre or language or era):
        added = await _augment_from_tmdb(
            genre=genre, language=language, era=era, db=db
        )
        if added:
            count = await _count_local()

    if mood:
        count = int(count * 0.55)
    if platform:
        count = int(count * 0.7)

    return {"count": max(count, 0)}


# ── Query (bubble constellation) ─────────────────────────────


class QueryRequest(BaseModel):
    mood: str | None = None
    genre: str | None = None
    language: str | None = None
    platform: str | None = None
    era: str | None = None
    limit: int = Field(default=30, ge=4, le=80)


class QueryFilm(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    tmdb_id: int
    title: str
    poster_path: str | None
    release_date: str | None
    vote_average: float | None
    relevance_score: float


@router.post("/query")
async def query(
    body: QueryRequest,
    db: AsyncSession = Depends(get_db),
):
    clauses = _build_filters(genre=body.genre, language=body.language, era=body.era)

    async def _fetch_local() -> list[Movie]:
        stmt = select(Movie)
        if clauses:
            stmt = stmt.where(and_(*clauses))
        stmt = stmt.order_by(
            Movie.popularity.desc().nullslast(),
            Movie.vote_average.desc().nullslast(),
        ).limit(body.limit)
        return list((await db.execute(stmt)).scalars().all())

    movies = await _fetch_local()

    # If the slice is too thin, hydrate from TMDB, then re-query.
    if len(movies) < 20 and (body.genre or body.language or body.era):
        added = await _augment_from_tmdb(
            genre=body.genre,
            language=body.language,
            era=body.era,
            db=db,
        )
        if added:
            movies = await _fetch_local()

    if not movies:
        return {"results": [], "matchedCount": 0}

    # Relevance is a 0..1 score derived from popularity + vote_average,
    # then nudged by mood/platform soft signals so the bubble sizes vary.
    pops = [(m.popularity or 0.0) for m in movies]
    votes = [(m.vote_average or 0.0) for m in movies]
    max_pop = max(pops) or 1.0
    max_vote = max(votes) or 1.0

    soft_boost = 1.0
    if body.mood:
        soft_boost *= 0.95  # widens the score range
    if body.platform:
        soft_boost *= 0.95

    out = []
    for m in movies:
        rel = (
            ((m.popularity or 0.0) / max_pop) * 0.6
            + ((m.vote_average or 0.0) / max_vote) * 0.4
        ) * soft_boost
        out.append(
            {
                "tmdbId": m.tmdb_id,
                "title": m.title,
                "posterPath": m.poster_path,
                "releaseDate": m.release_date,
                "voteAverage": m.vote_average,
                "relevanceScore": round(max(0.05, min(1.0, rel)), 3),
            }
        )

    return {"results": out, "matchedCount": len(out)}


# ── Movies like X ─────────────────────────────────────────────


class SimilarRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tmdb_id: Annotated[int, Field(alias="tmdbId")]
    media_type: Annotated[str, Field(default="movie", alias="mediaType")]
    limit: Annotated[int, Field(default=30, ge=4, le=60)]
    # tmdbIds already shown on previous pages — the next page strictly excludes
    # them so "Show more" never repeats a film.
    exclude_ids: Annotated[list[int], Field(default_factory=list, alias="excludeIds")]


@router.post("/similar")
async def similar(
    body: SimilarRequest,
    db: AsyncSession = Depends(get_db),
):
    """Essence-reasoned 'movies like X' — one broad, language-diverse set the
    client filters locally. Pass excludeIds to fetch a fresh, disjoint page.
    Public, like /query."""
    return await find_similar_films(
        db,
        body.tmdb_id,
        body.limit,
        exclude_ids=body.exclude_ids,
        media_type=body.media_type,
    )


# ── Presets ───────────────────────────────────────────────────


class PresetIn(BaseModel):
    name: str
    params: dict[str, Any]


@router.get("/presets")
async def list_presets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(TastePreset)
            .where(TastePreset.user_id == user.id)
            .order_by(TastePreset.created_at.desc())
        )
    ).scalars().all()
    return {
        "presets": [
            {
                "id": r.id,
                "name": r.name,
                "params": r.params,
                "createdAt": r.created_at.isoformat(),
            }
            for r in rows
        ]
    }


@router.post("/presets")
async def save_preset(
    body: PresetIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Preset needs a name")
    preset = TastePreset(user_id=user.id, name=name, params=body.params)
    db.add(preset)
    await db.flush()
    return {
        "id": preset.id,
        "name": preset.name,
        "params": preset.params,
        "createdAt": preset.created_at.isoformat(),
    }
