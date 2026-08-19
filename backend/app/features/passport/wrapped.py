"""Passport sharing — monthly, yearly, and Wrapped.

The payoff for keeping a diary: a picture of your cinema life you'd actually
want to send someone (KASET.md §8). Sharing is a designed surface here, not an
afterthought bolted onto stats.

Three shapes, one computation:
  /api/wrapped/{year}           the full year, story-shaped
  /api/wrapped/share/year/{y}   a card's worth of the same
  /api/wrapped/share/month/{y}/{m}

Everything derives from the diary, including private viewings — this is the
owner's own recap. Sharing renders it; it never exposes an endpoint someone
else can read.
"""

from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import DiaryEntry
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.films import film_payload

router = APIRouter(prefix="/api/wrapped", tags=["wrapped"])


def _genre_names(movie: Movie) -> list[str]:
    return [g.get("name") for g in (movie.genres or []) if isinstance(g, dict) and g.get("name")]


def _director_names(movie: Movie) -> list[str]:
    crew = (movie.credits or {}).get("crew") or []
    return [c.get("name") for c in crew if c.get("job") == "Director" and c.get("name")]


def _longest_streak(days: list[date]) -> int:
    """Longest run of consecutive calendar days with at least one viewing."""
    unique = sorted({d for d in days if d})
    if not unique:
        return 0
    best = run = 1
    for prev, cur in zip(unique, unique[1:]):
        run = run + 1 if (cur - prev).days == 1 else 1
        best = max(best, run)
    return best


async def _entries(
    db: AsyncSession, user_id: str, start: date, end: date
) -> list[tuple[DiaryEntry, Movie]]:
    return list(
        (
            await db.execute(
                select(DiaryEntry, Movie)
                .join(Movie, DiaryEntry.movie_id == Movie.id)
                .where(
                    DiaryEntry.user_id == user_id,
                    DiaryEntry.watched_on >= start,
                    DiaryEntry.watched_on <= end,
                )
                .order_by(DiaryEntry.watched_on.asc())
            )
        ).all()
    )


def _summarise(rows: list[tuple[DiaryEntry, Movie]]) -> dict:
    """The numbers behind every share card.

    `viewings` and `films` are reported separately — they diverge on every
    rewatch, and a card that shows only one of them misrepresents the period.
    """
    if not rows:
        return {"viewings": 0, "films": 0}

    unique: dict[str, Movie] = {}
    minutes = 0
    missing_runtime = 0
    theatre_visits = 0
    rewatches = 0
    genres: Counter[str] = Counter()
    directors: Counter[str] = Counter()
    actors: Counter[str] = Counter()
    views_per_film: Counter[str] = Counter()
    rated: list[tuple[float, Movie]] = []

    for entry, movie in rows:
        unique.setdefault(movie.id, movie)
        views_per_film[movie.id] += 1
        if movie.runtime:
            minutes += movie.runtime
        else:
            missing_runtime += 1
        if entry.watch_type == "theatre":
            theatre_visits += 1
        if entry.is_rewatch:
            rewatches += 1
        for name in _genre_names(movie):
            genres[name] += 1
        for name in _director_names(movie):
            directors[name] += 1
        # Billed cast only; counting the full list makes extras outrank leads.
        for c in ((movie.credits or {}).get("cast") or [])[:5]:
            if c.get("name"):
                actors[c["name"]] += 1
        if entry.rating is not None:
            rated.append((entry.rating, movie))

    most_rewatched = None
    if views_per_film:
        mid, count = views_per_film.most_common(1)[0]
        if count >= 2:
            most_rewatched = {**film_payload(unique[mid]), "views": count}

    ratings_only = [r for r, _ in rated]
    top_rated = [
        {**film_payload(m), "rating": r}
        for r, m in sorted(rated, key=lambda x: x[0], reverse=True)[:5]
    ]

    first_entry, first_movie = rows[0]
    last_entry, last_movie = rows[-1]

    return {
        "viewings": len(rows),
        "films": len(unique),
        "hours": round(minutes / 60, 1),
        # Surfaced so a low `hours` reads as thin data, not a thin year.
        "filmsMissingRuntime": missing_runtime,
        "theatreVisits": theatre_visits,
        "rewatches": rewatches,
        "averageRating": round(sum(ratings_only) / len(ratings_only), 2) if ratings_only else None,
        "streak": _longest_streak([e.watched_on for e, _ in rows]),
        "mostRewatched": most_rewatched,
        "topRated": top_rated,
        "favouriteFilm": top_rated[0] if top_rated else None,
        "topGenres": [{"name": n, "count": c} for n, c in genres.most_common(5)],
        "topDirector": (
            {"name": directors.most_common(1)[0][0], "count": directors.most_common(1)[0][1]}
            if directors else None
        ),
        "topActor": (
            {"name": actors.most_common(1)[0][0], "count": actors.most_common(1)[0][1]}
            if actors else None
        ),
        "firstFilm": {**film_payload(first_movie), "watchedOn": first_entry.watched_on.isoformat()},
        "lastFilm": {**film_payload(last_movie), "watchedOn": last_entry.watched_on.isoformat()},
    }


@router.get("/years")
async def wrapped_years(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Descending list of years the caller logged anything in."""
    rows = (
        await db.execute(
            select(extract("year", DiaryEntry.watched_on))
            .where(DiaryEntry.user_id == user.id)
            .distinct()
        )
    ).scalars().all()
    return {"years": sorted((int(y) for y in rows if y), reverse=True)}


@router.get("/share/month/{year}/{month}")
async def monthly_share(
    year: int,
    month: int = Path(..., ge=1, le=12),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A month's worth of cinema life, shaped for a share card."""
    if not 1900 <= year <= 2100:
        raise HTTPException(status_code=400, detail="Invalid year")

    start = date(year, month, 1)
    end_exclusive = date(year + (month == 12), (month % 12) + 1, 1)
    end = date.fromordinal(end_exclusive.toordinal() - 1)

    rows = await _entries(db, user.id, start, end)
    return {
        "period": "month",
        "year": year,
        "month": month,
        "label": start.strftime("%B %Y"),
        "user": {"name": user.name, "username": user.username, "avatarUrl": user.avatar_url},
        **_summarise(rows),
    }


@router.get("/share/year/{year}")
async def yearly_share(
    year: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A year's worth, shaped for a share card."""
    if not 1900 <= year <= 2100:
        raise HTTPException(status_code=400, detail="Invalid year")

    rows = await _entries(db, user.id, date(year, 1, 1), date(year, 12, 31))
    return {
        "period": "year",
        "year": year,
        "month": None,
        "label": str(year),
        "user": {"name": user.name, "username": user.username, "avatarUrl": user.avatar_url},
        **_summarise(rows),
    }


@router.get("/{year}")
async def wrapped_for_year(
    year: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The full year, story-shaped — the same numbers as the yearly card, with
    the tap-through Wrapped in mind."""
    if not 1900 <= year <= 2100:
        raise HTTPException(status_code=400, detail="Invalid year")

    rows = await _entries(db, user.id, date(year, 1, 1), date(year, 12, 31))
    return {
        "year": year,
        "user": {"name": user.name, "username": user.username, "avatarUrl": user.avatar_url},
        **_summarise(rows),
    }
