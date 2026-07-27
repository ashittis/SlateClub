"""Series API — TV-specific surfaces on top of the shared `movies` table.

A series is a Movie row with media_type='tv'. This router adds the season/
episode structure (fetched live from TMDB) plus the three rating types that
only make sense for series: overall (reuses /api/movies/{id}/rate?mediaType=tv),
per-season stars, and per-episode numeric ratings + quick reactions.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.shared.models.actions import EpisodeRating, EpisodeReaction, Rating, SeasonRating
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.features.movies.movies import _get_or_fetch_movie

router = APIRouter(prefix="/api/series", tags=["series"])


# ── Search ───────────────────────────────────────────────────


@router.get("/search")
async def search_series(q: str, page: int = 1):
    """TMDB TV search, normalized to the movie-search shape (title/release_date)
    so the frontend can render films and series with one card."""
    raw = await tmdb.search_tv(q, page)
    results = [
        {
            "id": r.get("id"),
            "title": r.get("name"),
            "poster_path": r.get("poster_path"),
            "release_date": r.get("first_air_date"),
            "vote_average": r.get("vote_average"),
            "media_type": "tv",
        }
        for r in (raw.get("results") or [])
    ]
    return {"results": results}


# ── Detail + structure ───────────────────────────────────────


@router.get("/{tmdb_id}")
async def get_series(tmdb_id: int, db: AsyncSession = Depends(get_db)):
    """Series detail + a season summary list (season 0 = specials, dropped)."""
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type="tv")
    raw = await tmdb.get_tv(tmdb_id)
    seasons = [
        {
            "seasonNumber": s.get("season_number"),
            "name": s.get("name"),
            "episodeCount": s.get("episode_count"),
            "posterPath": s.get("poster_path"),
            "airDate": s.get("air_date"),
        }
        for s in (raw.get("seasons") or [])
        if (s.get("season_number") or 0) > 0 and (s.get("episode_count") or 0) > 0
    ]
    return {
        "id": movie.id,
        "tmdbId": movie.tmdb_id,
        "mediaType": "tv",
        "title": movie.title,
        "overview": movie.overview,
        "posterPath": movie.poster_path,
        "backdropPath": movie.backdrop_path,
        "releaseDate": movie.release_date,
        "voteAverage": movie.vote_average,
        "originalLanguage": movie.original_language,
        "numberOfSeasons": movie.number_of_seasons,
        "genres": movie.genres,
        "credits": movie.credits,
        "seasons": seasons,
    }


@router.get("/{tmdb_id}/season/{season_number}")
async def get_season(tmdb_id: int, season_number: int):
    """Episodes for one season, each with TMDB's community vote average."""
    try:
        raw = await tmdb.get_tv_season(tmdb_id, season_number)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="Season not found") from exc
    return {
        "seasonNumber": season_number,
        "name": raw.get("name"),
        "overview": raw.get("overview"),
        "episodes": [
            {
                "episodeNumber": e.get("episode_number"),
                "name": e.get("name"),
                "overview": e.get("overview"),
                "stillPath": e.get("still_path"),
                "airDate": e.get("air_date"),
                "community": e.get("vote_average"),
            }
            for e in (raw.get("episodes") or [])
        ],
    }


# ── Ratings: season (stars) ──────────────────────────────────


class SeasonRateBody(BaseModel):
    # 0 clears; otherwise quarter-star precision.
    value: float = Field(ge=0, le=5, multiple_of=0.25)


async def _series_row(tmdb_id: int, db: AsyncSession) -> Movie:
    return await _get_or_fetch_movie(tmdb_id, db, media_type="tv")


@router.post("/{tmdb_id}/season/{season_number}/rate")
async def rate_season(
    tmdb_id: int,
    season_number: int,
    body: SeasonRateBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _series_row(tmdb_id, db)
    existing = (
        await db.execute(
            select(SeasonRating).where(
                SeasonRating.user_id == user.id,
                SeasonRating.movie_id == movie.id,
                SeasonRating.season_number == season_number,
            )
        )
    ).scalar_one_or_none()
    if body.value == 0:
        if existing:
            await db.delete(existing)
        await db.flush()
        return {"ok": True, "value": None}
    if existing:
        existing.value = body.value
    else:
        db.add(
            SeasonRating(
                user_id=user.id,
                movie_id=movie.id,
                season_number=season_number,
                value=body.value,
            )
        )
    await db.flush()
    return {"ok": True, "value": body.value}


# ── Ratings: episode (numeric 1–10) + reaction ───────────────


class EpisodeRateBody(BaseModel):
    # 0 clears; otherwise 1–10 in half steps (IMDb-style).
    value: float = Field(ge=0, le=10, multiple_of=0.5)


@router.post("/{tmdb_id}/season/{season_number}/episode/{episode_number}/rate")
async def rate_episode(
    tmdb_id: int,
    season_number: int,
    episode_number: int,
    body: EpisodeRateBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _series_row(tmdb_id, db)
    existing = (
        await db.execute(
            select(EpisodeRating).where(
                EpisodeRating.user_id == user.id,
                EpisodeRating.movie_id == movie.id,
                EpisodeRating.season_number == season_number,
                EpisodeRating.episode_number == episode_number,
            )
        )
    ).scalar_one_or_none()
    if body.value == 0:
        if existing:
            await db.delete(existing)
        await db.flush()
        return {"ok": True, "value": None}
    if existing:
        existing.value = body.value
    else:
        db.add(
            EpisodeRating(
                user_id=user.id,
                movie_id=movie.id,
                season_number=season_number,
                episode_number=episode_number,
                value=body.value,
            )
        )
    await db.flush()
    return {"ok": True, "value": body.value}


class EpisodeReactionBody(BaseModel):
    reaction: str | None = None  # null clears


@router.post("/{tmdb_id}/season/{season_number}/episode/{episode_number}/reaction")
async def react_episode(
    tmdb_id: int,
    season_number: int,
    episode_number: int,
    body: EpisodeReactionBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _series_row(tmdb_id, db)
    existing = (
        await db.execute(
            select(EpisodeReaction).where(
                EpisodeReaction.user_id == user.id,
                EpisodeReaction.movie_id == movie.id,
                EpisodeReaction.season_number == season_number,
                EpisodeReaction.episode_number == episode_number,
            )
        )
    ).scalar_one_or_none()
    if not body.reaction:
        if existing:
            await db.delete(existing)
        await db.flush()
        return {"ok": True, "reaction": None}
    if existing:
        existing.reaction = body.reaction
    else:
        db.add(
            EpisodeReaction(
                user_id=user.id,
                movie_id=movie.id,
                season_number=season_number,
                episode_number=episode_number,
                reaction=body.reaction,
            )
        )
    await db.flush()
    return {"ok": True, "reaction": body.reaction}


# ── The current user's ratings for a whole series ────────────


@router.get("/{tmdb_id}/my-ratings")
async def my_series_ratings(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Overall + per-season + per-episode ratings/reactions in one payload, so
    the series page can hydrate the whole grid in a single request."""
    movie = await _series_row(tmdb_id, db)

    overall = (
        await db.execute(
            select(Rating).where(
                Rating.user_id == user.id, Rating.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    seasons = (
        await db.execute(
            select(SeasonRating).where(
                SeasonRating.user_id == user.id, SeasonRating.movie_id == movie.id
            )
        )
    ).scalars().all()
    episodes = (
        await db.execute(
            select(EpisodeRating).where(
                EpisodeRating.user_id == user.id, EpisodeRating.movie_id == movie.id
            )
        )
    ).scalars().all()
    reactions = (
        await db.execute(
            select(EpisodeReaction).where(
                EpisodeReaction.user_id == user.id,
                EpisodeReaction.movie_id == movie.id,
            )
        )
    ).scalars().all()

    return {
        "overall": overall.value if overall else None,
        "seasons": {str(s.season_number): s.value for s in seasons},
        "episodes": {
            f"{e.season_number}:{e.episode_number}": e.value for e in episodes
        },
        "reactions": {
            f"{r.season_number}:{r.episode_number}": r.reaction for r in reactions
        },
    }
