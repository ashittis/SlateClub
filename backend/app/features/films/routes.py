"""Films — search, browse, detail, and the viewer's relationship to a film.

The film page is Kaset's central content object, and its primary action is
**Log this film** (KASET.md §8). So this slice deliberately does *not* own
logging: `/api/diary` does, with `diary_service` as the single writer. What
lives here is everything needed to render a film and decide what to show.

Routes are addressed by **TMDB id**, not internal uuid, so the client can act on
a film straight from search results without a resolve round-trip.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.shared.models.actions import (
    CurrentlyWatching,
    DiaryEntry,
    Rating,
    Review,
    WatchHistory,
    WatchlistItem,
)
from app.shared.models.user import User
from app.shared.services.films import (
    directors_of,
    film_payload,
    get_or_fetch_film,
    top_cast,
)

router = APIRouter(prefix="/api/films", tags=["films"])


def _card(raw: dict) -> dict:
    """A TMDB search/browse result reduced to the poster-card shape."""
    return {
        "tmdbId": raw["id"],
        "title": raw.get("title") or "",
        "posterPath": raw.get("poster_path"),
        "year": (raw.get("release_date") or "")[:4] or None,
        "voteAverage": raw.get("vote_average"),
    }


# ── Search & browse ──────────────────────────────────────────────────────────

@router.get("/search")
async def search(q: str = Query(..., min_length=1), page: int = 1):
    try:
        data = await tmdb.search_movies(q, page)
    except Exception:  # noqa: BLE001 - a TMDB outage yields no results, not a 500
        return {"results": [], "page": page}
    return {
        "results": [_card(r) for r in (data.get("results") or []) if r.get("id")],
        "page": page,
    }


@router.get("/trending")
async def trending():
    try:
        data = await tmdb.get_trending_movies()
    except Exception:  # noqa: BLE001
        return {"results": []}
    return {"results": [_card(r) for r in (data.get("results") or []) if r.get("id")]}


@router.get("/popular")
async def popular(page: int = 1):
    try:
        data = await tmdb.get_popular_movies(page)
    except Exception:  # noqa: BLE001
        return {"results": []}
    return {"results": [_card(r) for r in (data.get("results") or []) if r.get("id")]}


# ── Detail ───────────────────────────────────────────────────────────────────

@router.get("/{tmdb_id}")
async def detail(tmdb_id: int, db: AsyncSession = Depends(get_db)):
    """Full film detail. Resolving also caches the film locally, which is what
    lets every later action address it by TMDB id."""
    film = await get_or_fetch_film(tmdb_id, db)
    return {
        **film_payload(film),
        "overview": film.overview,
        "genres": [g.get("name") for g in (film.genres or []) if g.get("name")],
        "directors": directors_of(film),
        "cast": top_cast(film),
        "voteCount": film.vote_count,
    }


@router.get("/{tmdb_id}/status")
async def status(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The viewer's relationship to this film — what the page needs to decide
    between "Log this film" and "Log again", and whether to offer a rewatch."""
    film = await get_or_fetch_film(tmdb_id, db)

    watchlisted = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id, WatchlistItem.movie_id == film.id
            )
        )
    ).scalar_one_or_none()

    watching = (
        await db.execute(
            select(CurrentlyWatching).where(
                CurrentlyWatching.user_id == user.id,
                CurrentlyWatching.movie_id == film.id,
            )
        )
    ).scalar_one_or_none()

    rating = (
        await db.execute(
            select(Rating).where(Rating.user_id == user.id, Rating.movie_id == film.id)
        )
    ).scalar_one_or_none()

    review = (
        await db.execute(
            select(Review).where(Review.user_id == user.id, Review.movie_id == film.id)
        )
    ).scalar_one_or_none()

    log_count = (
        await db.execute(
            select(func.count(DiaryEntry.id)).where(
                DiaryEntry.user_id == user.id, DiaryEntry.movie_id == film.id
            )
        )
    ).scalar_one() or 0

    seen = (
        await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user.id, WatchHistory.movie_id == film.id
            )
        )
    ).scalar_one_or_none() is not None

    return {
        "filmId": film.id,
        "inWatchlist": watchlisted is not None,
        "watchlistNote": watchlisted.note if watchlisted else None,
        "watching": (
            {
                "progressPct": watching.progress_pct,
                "startedAt": watching.started_at.isoformat(),
            }
            if watching
            else None
        ),
        "rating": rating.value if rating else None,
        "hasReview": review is not None,
        "logCount": log_count,
        # Drives the log sheet's rewatch default: a film you've already logged
        # is a rewatch by default, one you haven't never is.
        "seen": seen,
    }


@router.get("/{tmdb_id}/viewings")
async def viewings(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """This viewer's own history with the film — every logged viewing, newest
    first. This is what makes rewatch visible on the film page (KASET.md §8)."""
    film = await get_or_fetch_film(tmdb_id, db)
    entries = (
        await db.execute(
            select(DiaryEntry)
            .where(DiaryEntry.user_id == user.id, DiaryEntry.movie_id == film.id)
            .order_by(DiaryEntry.watched_on.desc(), DiaryEntry.created_at.desc())
        )
    ).scalars().all()
    return {
        "viewings": [
            {
                "id": e.id,
                "watchedOn": e.watched_on.isoformat(),
                "rating": e.rating,
                "liked": e.liked,
                "isRewatch": e.is_rewatch,
                "watchType": e.watch_type,
                "theatreName": e.theatre_name,
                "tags": list(e.tags or []),
                "visibility": e.visibility,
                "reviewId": e.review_id,
            }
            for e in entries
        ]
    }


# ── Watchlist (addressed by TMDB id) ─────────────────────────────────────────

class WatchlistBody(BaseModel):
    note: str | None = None


@router.post("/{tmdb_id}/watchlist")
async def add_to_watchlist(
    tmdb_id: int,
    body: WatchlistBody | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    film = await get_or_fetch_film(tmdb_id, db)
    existing = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id, WatchlistItem.movie_id == film.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        if body and body.note is not None:
            existing.note = body.note
    else:
        db.add(
            WatchlistItem(
                user_id=user.id,
                movie_id=film.id,
                note=body.note if body else None,
            )
        )
    await db.flush()
    return {"ok": True, "inWatchlist": True}


@router.delete("/{tmdb_id}/watchlist")
async def remove_from_watchlist(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    film = await get_or_fetch_film(tmdb_id, db)
    row = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id, WatchlistItem.movie_id == film.id
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.flush()
    return {"ok": True, "inWatchlist": False}


# ── Rating (addressed by TMDB id) ────────────────────────────────────────────

class RateBody(BaseModel):
    rating: float = Field(..., ge=0, le=5, multiple_of=0.25)


@router.post("/{tmdb_id}/rate")
async def rate(
    tmdb_id: int,
    body: RateBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or clear the viewer's current rating. Rating alone never fabricates
    a viewing — that only happens when the user actually logs the film."""
    film = await get_or_fetch_film(tmdb_id, db)
    existing = (
        await db.execute(
            select(Rating).where(Rating.user_id == user.id, Rating.movie_id == film.id)
        )
    ).scalar_one_or_none()

    if body.rating == 0:
        if existing:
            await db.delete(existing)
        await db.flush()
        return {"ok": True, "rating": None}

    if existing:
        existing.value = body.rating
    else:
        db.add(Rating(user_id=user.id, movie_id=film.id, value=body.rating))
    await db.flush()
    return {"ok": True, "rating": body.rating}


# ── Currently watching ───────────────────────────────────────────────────────

class WatchingBody(BaseModel):
    progress_pct: float = Field(0.0, ge=0, le=100, alias="progressPct")

    model_config = {"populate_by_name": True}


@router.post("/{tmdb_id}/watching")
async def start_watching(
    tmdb_id: int,
    body: WatchingBody | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    film = await get_or_fetch_film(tmdb_id, db)
    row = (
        await db.execute(
            select(CurrentlyWatching).where(
                CurrentlyWatching.user_id == user.id,
                CurrentlyWatching.movie_id == film.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        row.progress_pct = body.progress_pct if body else row.progress_pct
    else:
        db.add(
            CurrentlyWatching(
                user_id=user.id,
                movie_id=film.id,
                progress_pct=body.progress_pct if body else 0.0,
            )
        )
    await db.flush()
    return {"ok": True, "watching": True}


@router.delete("/{tmdb_id}/watching")
async def stop_watching(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    film = await get_or_fetch_film(tmdb_id, db)
    row = (
        await db.execute(
            select(CurrentlyWatching).where(
                CurrentlyWatching.user_id == user.id,
                CurrentlyWatching.movie_id == film.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.flush()
    return {"ok": True, "watching": False}


# ── People ───────────────────────────────────────────────────────────────────

@router.get("/people/{person_id}")
async def person(person_id: int):
    """A director or actor, with their film credits — the destination for a
    name tapped on a film page or found in search."""
    try:
        details = await tmdb.get_person_details(person_id)
        credits = await tmdb.get_person_movie_credits(person_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"Person {person_id} not found") from exc

    cast = credits.get("cast") or []
    crew = [c for c in (credits.get("crew") or []) if c.get("job") == "Director"]
    films = {c["id"]: c for c in [*crew, *cast] if c.get("id")}
    ordered = sorted(
        films.values(),
        key=lambda c: (c.get("release_date") or "0000"),
        reverse=True,
    )

    return {
        "tmdbId": details.get("id"),
        "name": details.get("name"),
        "profilePath": details.get("profile_path"),
        "biography": details.get("biography"),
        "knownFor": details.get("known_for_department"),
        "films": [_card(c) for c in ordered if c.get("id")],
    }
