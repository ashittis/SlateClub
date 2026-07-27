"""SlateClub Wrapped — a Spotify-style yearly recap computed from the diary.

Openable anytime for any year with data. Aggregates the caller's own viewings
(`watch_log`) — including private ones, since it's their own recap — plus movie
metadata for genres/director/runtime. All heavy lifting is a single scan of the
year's diary rows joined to movies; everything else is in-memory tallying.
"""

from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import DiaryEntry
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.features.users.users import _movie_payload

router = APIRouter(prefix="/api/wrapped", tags=["wrapped"])


def _genre_names(movie: Movie) -> list[str]:
    return [g.get("name", "") for g in (movie.genres or []) if isinstance(g, dict) and g.get("name")]


def _director_names(movie: Movie) -> list[str]:
    """Directors from the cached TMDB credits JSON (crew with job Director)."""
    credits = movie.credits or {}
    crew = credits.get("crew") if isinstance(credits, dict) else None
    if not isinstance(crew, list):
        return []
    return [
        c.get("name", "")
        for c in crew
        if isinstance(c, dict) and c.get("job") == "Director" and c.get("name")
    ]


def _longest_streak(dates: list) -> int:
    """Longest run of consecutive calendar days that each have ≥1 viewing."""
    days = sorted({d.date() for d in dates if d})
    if not days:
        return 0
    best = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if (cur - prev).days == 1 else 1
        best = max(best, run)
    return best


@router.get("/years")
async def wrapped_years(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Descending list of years the caller has at least one viewing in."""
    rows = (
        await db.execute(
            select(extract("year", DiaryEntry.watched_at))
            .where(DiaryEntry.user_id == user.id)
            .distinct()
        )
    ).scalars().all()
    return sorted({int(y) for y in rows if y is not None}, reverse=True)


@router.get("/{year}")
async def wrapped_for_year(
    year: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if year < 1900 or year > 2100:
        raise HTTPException(status_code=400, detail="Invalid year")

    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    rows = (
        await db.execute(
            select(DiaryEntry, Movie)
            .join(Movie, DiaryEntry.movie_id == Movie.id)
            .where(
                DiaryEntry.user_id == user.id,
                DiaryEntry.watched_at >= start,
                DiaryEntry.watched_at < end,
            )
            .order_by(DiaryEntry.watched_at.asc())
        )
    ).all()

    total_films = len(rows)
    if total_films == 0:
        return {"year": year, "totalFilms": 0}

    unique_movies: dict[str, Movie] = {}
    total_minutes = 0
    films_missing_runtime = 0
    theatre_visits = 0
    rewatch_count = 0
    genre_counter: Counter[str] = Counter()
    director_counter: Counter[str] = Counter()
    mood_counter: Counter[str] = Counter()
    per_movie_views: Counter[str] = Counter()
    best_rated: list[tuple[float, Movie]] = []

    for entry, movie in rows:
        unique_movies.setdefault(movie.id, movie)
        per_movie_views[movie.id] += 1
        if movie.runtime:
            total_minutes += movie.runtime
        else:
            films_missing_runtime += 1
        if entry.at_theatre:
            theatre_visits += 1
        if entry.is_rewatch:
            rewatch_count += 1
        for name in _genre_names(movie):
            genre_counter[name] += 1
        for name in _director_names(movie):
            director_counter[name] += 1
        identity = movie.identity_json if isinstance(movie.identity_json, dict) else {}
        for theme in (identity.get("themes") or [])[:3]:
            if isinstance(theme, str):
                mood_counter[theme] += 1
        if entry.rating is not None:
            best_rated.append((entry.rating, movie))

    # Most-rewatched: the film with the most viewings this year (min 2).
    most_rewatched = None
    if per_movie_views:
        mid, count = per_movie_views.most_common(1)[0]
        if count >= 2:
            most_rewatched = {**_movie_payload(unique_movies[mid]), "views": count}

    top_rated = [
        {**_movie_payload(m), "rating": r}
        for r, m in sorted(best_rated, key=lambda x: x[0], reverse=True)[:5]
    ]

    first_entry, first_movie = rows[0]
    last_entry, last_movie = rows[-1]

    return {
        "year": year,
        "totalFilms": total_films,
        "uniqueFilms": len(unique_movies),
        "totalHours": round(total_minutes / 60, 1),
        "filmsMissingRuntime": films_missing_runtime,
        "theatreVisits": theatre_visits,
        "rewatchCount": rewatch_count,
        "mostRewatched": most_rewatched,
        "streak": _longest_streak([e.watched_at for e, _ in rows]),
        "topRated": top_rated,
        "topGenres": [{"name": n, "count": c} for n, c in genre_counter.most_common(5)],
        "topMoods": [{"name": n, "count": c} for n, c in mood_counter.most_common(5)],
        "topDirector": (
            {"name": director_counter.most_common(1)[0][0], "count": director_counter.most_common(1)[0][1]}
            if director_counter
            else None
        ),
        "firstFilm": {
            **_movie_payload(first_movie),
            "watchedAt": first_entry.watched_at.isoformat() if first_entry.watched_at else None,
        },
        "lastFilm": {
            **_movie_payload(last_movie),
            "watchedAt": last_entry.watched_at.isoformat() if last_entry.watched_at else None,
        },
    }
