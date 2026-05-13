from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..integrations import tmdb
from ..models.actions import Rating, WatchHistory, WatchlistItem
from ..models.movie import Movie
from ..models.user import User

router = APIRouter(prefix="/api/movies", tags=["movies"])


# ── Helpers ──────────────────────────────────────────────────

async def _upsert_movie(db: AsyncSession, data: dict) -> Movie:
    """Fetch a movie from TMDB, cache it in the DB, and return the DB record."""
    tmdb_id = data.get("id") or data.get("tmdb_id")
    result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    movie = result.scalar_one_or_none()

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

    if movie:
        for k, v in fields.items():
            if v is not None:
                setattr(movie, k, v)
    else:
        movie = Movie(tmdb_id=tmdb_id, **fields)
        db.add(movie)

    await db.flush()
    return movie


# ── Routes ───────────────────────────────────────────────────

@router.get("/search")
async def search_movies(q: str = Query(..., min_length=1), page: int = 1):
    return await tmdb.search_movies(q, page)


@router.get("/trending")
async def trending_movies():
    return await tmdb.get_trending_movies()


@router.get("/popular")
async def popular_movies(page: int = 1):
    return await tmdb.get_popular_movies(page)


@router.get("/top-rated")
async def top_rated_movies(page: int = 1):
    return await tmdb.get_top_rated_movies(page)


@router.get("/discover")
async def discover(
    page: int = 1,
    sort_by: str | None = None,
    with_genres: str | None = None,
    year: int | None = None,
    primary_release_year: int | None = None,
    with_original_language: str | None = None,
    vote_average_gte: float | None = None,
):
    params: dict = {"page": page}
    if sort_by:
        params["sort_by"] = sort_by
    if with_genres:
        params["with_genres"] = with_genres
    if year:
        params["year"] = year
    if primary_release_year:
        params["primary_release_year"] = primary_release_year
    if with_original_language:
        params["with_original_language"] = with_original_language
    if vote_average_gte is not None:
        params["vote_average.gte"] = vote_average_gte
    return await tmdb.discover_movies(params)


@router.get("/{tmdb_id}")
async def get_movie(tmdb_id: int, db: AsyncSession = Depends(get_db)):
    data = await tmdb.get_movie(tmdb_id)
    credits_data = await tmdb.get_movie_credits(tmdb_id)
    data["credits"] = credits_data

    movie = await _upsert_movie(db, data)

    return {
        "id": movie.id,
        "tmdb_id": movie.tmdb_id,
        "tmdbId": movie.tmdb_id,
        "title": movie.title,
        "overview": movie.overview,
        "poster_path": movie.poster_path,
        "posterPath": movie.poster_path,
        "backdrop_path": movie.backdrop_path,
        "backdropPath": movie.backdrop_path,
        "release_date": movie.release_date,
        "releaseDate": movie.release_date,
        "runtime": movie.runtime,
        "vote_average": movie.vote_average,
        "voteAverage": movie.vote_average,
        "vote_count": movie.vote_count,
        "voteCount": movie.vote_count,
        "popularity": movie.popularity,
        "original_language": movie.original_language,
        "originalLanguage": movie.original_language,
        "genres": movie.genres,
        "credits": movie.credits,
    }


# ── Per-tmdb_id user actions (used by film page) ─────────────


async def _get_or_fetch_movie(tmdb_id: int, db: AsyncSession) -> Movie:
    """Resolve a tmdb_id to a local Movie row. Lazily fetches from
    TMDB if we haven't seen this film yet, so users can rate / shelve
    a film straight from search without opening detail first."""
    row = (
        await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    ).scalar_one_or_none()
    if row is not None:
        return row
    try:
        data = await tmdb.get_movie(tmdb_id)
        credits_data = await tmdb.get_movie_credits(tmdb_id)
        data["credits"] = credits_data
        return await _upsert_movie(db, data)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Movie {tmdb_id} not found") from exc


@router.get("/{tmdb_id}/status")
async def get_movie_status(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db)
    in_wl = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id,
                WatchlistItem.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none() is not None
    watched = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user.id,
                WatchHistory.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none() is not None
    rating_row = (
        await db.execute(
            select(Rating).where(
                Rating.user_id == user.id, Rating.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    return {
        "inWatchlist": in_wl,
        "watched": watched,
        "rating": rating_row.value if rating_row else None,
    }


@router.post("/{tmdb_id}/watchlist")
async def add_to_watchlist(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db)
    existing = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id,
                WatchlistItem.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(WatchlistItem(user_id=user.id, movie_id=movie.id))
        await db.flush()
    return {"ok": True, "inWatchlist": True}


@router.delete("/{tmdb_id}/watchlist")
async def remove_from_watchlist(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db)
    row = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id,
                WatchlistItem.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True, "inWatchlist": False}


@router.post("/{tmdb_id}/watched")
async def mark_watched(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db)
    existing = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user.id,
                WatchHistory.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(
            WatchHistory(user_id=user.id, movie_id=movie.id, completion_pct=100.0)
        )
        await db.flush()
    return {"ok": True, "watched": True}


@router.delete("/{tmdb_id}/watched")
async def unmark_watched(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db)
    row = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user.id,
                WatchHistory.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True, "watched": False}


class RateBody(BaseModel):
    rating: float = Field(ge=0, le=5)


@router.post("/{tmdb_id}/rate")
async def rate_film(
    tmdb_id: int,
    body: RateBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db)
    existing = (
        await db.execute(
            select(Rating).where(
                Rating.user_id == user.id, Rating.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    if body.rating == 0:
        # 0 stars = clear the rating.
        if existing:
            await db.delete(existing)
        return {"ok": True, "rating": None}
    if existing:
        existing.value = body.rating
    else:
        db.add(Rating(user_id=user.id, movie_id=movie.id, value=body.rating))
    await db.flush()
    return {"ok": True, "rating": body.rating}
