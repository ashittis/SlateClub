from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..integrations import tmdb
from ..models.actions import (
    CurrentlyWatching,
    DnfEntry,
    Rating,
    WatchHistory,
    WatchlistItem,
)
from ..models.movie import Movie
from ..models.social import MicroFeedback
from ..models.user import User
from ..services.taste_cache import invalidate_user_taste_vector

router = APIRouter(prefix="/api/movies", tags=["movies"])


# ── Helpers ──────────────────────────────────────────────────

def _normalize_tv_data(data: dict) -> dict:
    """Map a TMDB /tv payload onto the shared Movie field names so series and
    films live in one table (name→title, first_air_date→release_date, etc.)."""
    runtimes = data.get("episode_run_time") or []
    return {
        **data,
        "title": data.get("name") or data.get("title") or "",
        "release_date": data.get("first_air_date") or data.get("release_date"),
        "runtime": (runtimes[0] if runtimes else None),
        "number_of_seasons": data.get("number_of_seasons"),
    }


async def _upsert_movie(db: AsyncSession, data: dict, media_type: str = "movie") -> Movie:
    """Cache a TMDB title (film or series) in the DB and return the record.
    For series, pass media_type='tv' with data already normalized via
    _normalize_tv_data."""
    tmdb_id = data.get("id") or data.get("tmdb_id")
    result = await db.execute(
        select(Movie).where(
            Movie.tmdb_id == tmdb_id, Movie.media_type == media_type
        )
    )
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
        number_of_seasons=data.get("number_of_seasons"),
    )

    if movie:
        for k, v in fields.items():
            if v is not None:
                setattr(movie, k, v)
    else:
        movie = Movie(tmdb_id=tmdb_id, media_type=media_type, **fields)
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


async def _get_or_fetch_movie(
    tmdb_id: int, db: AsyncSession, media_type: str = "movie"
) -> Movie:
    """Resolve a (tmdb_id, media_type) to a local Movie row. Lazily fetches from
    TMDB if we haven't seen this title yet, so users can rate / shelve straight
    from search. Handles both films and TV series."""
    row = (
        await db.execute(
            select(Movie).where(
                Movie.tmdb_id == tmdb_id, Movie.media_type == media_type
            )
        )
    ).scalar_one_or_none()
    if row is not None:
        return row
    try:
        if media_type == "tv":
            data = _normalize_tv_data(await tmdb.get_tv(tmdb_id))
            data["credits"] = await tmdb.get_tv_credits(tmdb_id)
            return await _upsert_movie(db, data, media_type="tv")
        data = await tmdb.get_movie(tmdb_id)
        data["credits"] = await tmdb.get_movie_credits(tmdb_id)
        return await _upsert_movie(db, data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=404, detail=f"{media_type} {tmdb_id} not found"
        ) from exc


@router.get("/{tmdb_id}/status")
async def get_movie_status(
    tmdb_id: int,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
    wl_row = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id,
                WatchlistItem.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    watching_row = (
        await db.execute(
            select(CurrentlyWatching).where(
                CurrentlyWatching.user_id == user.id,
                CurrentlyWatching.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    watched = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user.id,
                WatchHistory.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none() is not None
    dnf_row = (
        await db.execute(
            select(DnfEntry).where(
                DnfEntry.user_id == user.id, DnfEntry.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    rating_row = (
        await db.execute(
            select(Rating).where(
                Rating.user_id == user.id, Rating.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    return {
        "mediaType": media_type,
        "inWatchlist": wl_row is not None,
        "shelf": {
            "reasonType": wl_row.reason_type,
            "reasonReference": wl_row.reason_reference,
            "note": wl_row.note,
        }
        if wl_row
        else None,
        "watching": {
            "progressPct": watching_row.progress_pct,
            "startedAt": watching_row.started_at.isoformat(),
        }
        if watching_row
        else None,
        "watched": watched,
        "dnf": {
            "reason": dnf_row.reason,
            "stoppedAt": dnf_row.stopped_at,
            "progressPct": dnf_row.progress_pct,
        }
        if dnf_row
        else None,
        "rating": rating_row.value if rating_row else None,
    }


class ShelfBody(BaseModel):
    # Shelf Notes — all optional ("Skip" sends an empty body).
    reasonType: str | None = None
    reasonReference: str | None = None
    note: str | None = None


@router.post("/{tmdb_id}/watchlist")
async def add_to_watchlist(
    tmdb_id: int,
    body: ShelfBody | None = None,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
    existing = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id,
                WatchlistItem.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    reason_type = body.reasonType if body else None
    reason_reference = body.reasonReference if body else None
    note = body.note if body else None
    if existing:
        # Re-shelving updates the saved reason/note.
        existing.reason_type = reason_type
        existing.reason_reference = reason_reference
        existing.note = note
    else:
        db.add(
            WatchlistItem(
                user_id=user.id,
                movie_id=movie.id,
                reason_type=reason_type,
                reason_reference=reason_reference,
                note=note,
            )
        )
    await db.flush()
    return {"ok": True, "inWatchlist": True}


@router.delete("/{tmdb_id}/watchlist")
async def remove_from_watchlist(
    tmdb_id: int,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
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


async def _clear_states(db: AsyncSession, user_id: str, movie_id: str, *models) -> None:
    """Delete the user's row(s) for this movie from the given lifecycle tables.
    Used to keep Shelf/Watching/Watched/DNF mutually exclusive."""
    for model in models:
        row = (
            await db.execute(
                select(model).where(
                    model.user_id == user_id, model.movie_id == movie_id
                )
            )
        ).scalar_one_or_none()
        if row:
            await db.delete(row)


@router.post("/{tmdb_id}/watched")
async def mark_watched(
    tmdb_id: int,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
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
    # Watched is terminal — it leaves the shelf, the watching list, and DNF.
    await _clear_states(db, user.id, movie.id, WatchlistItem, CurrentlyWatching, DnfEntry)
    await db.flush()
    return {"ok": True, "watched": True}


@router.delete("/{tmdb_id}/watched")
async def unmark_watched(
    tmdb_id: int,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
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


# ── Currently Watching ───────────────────────────────────────


class WatchingBody(BaseModel):
    progressPct: float | None = None


@router.post("/{tmdb_id}/watching")
async def start_watching(
    tmdb_id: int,
    body: WatchingBody | None = None,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
    progress = (body.progressPct if body and body.progressPct is not None else 0.0)
    existing = (
        await db.execute(
            select(CurrentlyWatching).where(
                CurrentlyWatching.user_id == user.id,
                CurrentlyWatching.movie_id == movie.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.progress_pct = progress
    else:
        db.add(
            CurrentlyWatching(
                user_id=user.id, movie_id=movie.id, progress_pct=progress
            )
        )
    # Starting moves the film off the shelf and clears any prior DNF.
    await _clear_states(db, user.id, movie.id, WatchlistItem, DnfEntry)
    await db.flush()
    return {"ok": True, "watching": True}


@router.delete("/{tmdb_id}/watching")
async def stop_watching(
    tmdb_id: int,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
    await _clear_states(db, user.id, movie.id, CurrentlyWatching)
    await db.flush()
    return {"ok": True, "watching": False}


# ── DNF (Didn't Finish) ──────────────────────────────────────


class DnfBody(BaseModel):
    reason: str | None = None
    stoppedAt: str | None = None
    progressPct: float | None = None


@router.post("/{tmdb_id}/dnf")
async def mark_dnf(
    tmdb_id: int,
    body: DnfBody | None = None,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
    reason = body.reason if body else None
    stopped_at = body.stoppedAt if body else None
    progress = body.progressPct if body else None
    existing = (
        await db.execute(
            select(DnfEntry).where(
                DnfEntry.user_id == user.id, DnfEntry.movie_id == movie.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.reason = reason
        existing.stopped_at = stopped_at
        existing.progress_pct = progress
    else:
        db.add(
            DnfEntry(
                user_id=user.id,
                movie_id=movie.id,
                reason=reason,
                stopped_at=stopped_at,
                progress_pct=progress,
            )
        )
    # DNF leaves the shelf + watching list; it's a negative taste signal.
    await _clear_states(db, user.id, movie.id, WatchlistItem, CurrentlyWatching)
    db.add(MicroFeedback(user_id=user.id, movie_id=movie.id, type="dnf"))
    await db.flush()
    await invalidate_user_taste_vector(user.id)
    return {"ok": True, "dnf": True}


@router.delete("/{tmdb_id}/dnf")
async def remove_dnf(
    tmdb_id: int,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
    await _clear_states(db, user.id, movie.id, DnfEntry)
    await db.flush()
    return {"ok": True, "dnf": False}


class RateBody(BaseModel):
    # 0 clears the rating; otherwise quarter-star precision (0.25 … 5.0).
    rating: float = Field(ge=0, le=5, multiple_of=0.25)


@router.post("/{tmdb_id}/rate")
async def rate_film(
    tmdb_id: int,
    body: RateBody,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = await _get_or_fetch_movie(tmdb_id, db, media_type)
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
        await invalidate_user_taste_vector(user.id)
        return {"ok": True, "rating": None}
    if existing:
        existing.value = body.rating
    else:
        db.add(Rating(user_id=user.id, movie_id=movie.id, value=body.rating))
    await db.flush()
    await invalidate_user_taste_vector(user.id)
    return {"ok": True, "rating": body.rating}
