"""Passport statistics — a user's cinema life, counted.

Everything here is derived from the diary. Nothing is stored, so the numbers
can never drift out of step with what was actually logged.

Private viewings count toward *your own* totals but are excluded when someone
else is looking. That asymmetry is the whole point of marking a viewing private,
and it is applied here rather than in each caller so it cannot be forgotten.
"""

from __future__ import annotations

from collections import Counter
from datetime import date

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.actions import DiaryEntry, Rating, Review, WatchlistItem
from app.shared.models.movie import Movie
from app.shared.services.films import film_payload


def visible_viewings(user_id: str, *, viewer_is_owner: bool) -> Select:
    """Base query for a user's viewings, honouring privacy."""
    stmt = select(DiaryEntry).where(DiaryEntry.user_id == user_id)
    if not viewer_is_owner:
        stmt = stmt.where(DiaryEntry.visibility == "public")
    return stmt


def _period_bounds(period: str, year: int | None, month: int | None) -> tuple[date, date] | None:
    """Inclusive (start, end) for the requested window, or None for all time."""
    if period == "year" and year:
        return date(year, 1, 1), date(year, 12, 31)
    if period == "month" and year and month:
        start = date(year, month, 1)
        end = date(year + (month == 12), (month % 12) + 1, 1)
        return start, date.fromordinal(end.toordinal() - 1)
    return None


async def summary(
    db: AsyncSession,
    user_id: str,
    *,
    viewer_is_owner: bool,
    period: str = "all",
    year: int | None = None,
    month: int | None = None,
) -> dict:
    """The headline numbers: films, theatre visits, rewatches, average rating.

    `films` counts distinct films; `viewings` counts logs. They differ whenever
    someone rewatches, and conflating them is the easiest way to make a Wrapped
    card lie.
    """
    bounds = _period_bounds(period, year, month)

    stmt = visible_viewings(user_id, viewer_is_owner=viewer_is_owner)
    if bounds:
        stmt = stmt.where(DiaryEntry.watched_on >= bounds[0], DiaryEntry.watched_on <= bounds[1])

    entries = (await db.execute(stmt)).scalars().all()
    minutes = await runtime_minutes(db, user_id, viewer_is_owner=viewer_is_owner, bounds=bounds)

    rated = [e.rating for e in entries if e.rating is not None]
    return {
        "period": period,
        "year": year,
        "month": month,
        "viewings": len(entries),
        "films": len({e.movie_id for e in entries}),
        "theatreVisits": sum(1 for e in entries if e.watch_type == "theatre"),
        "rewatches": sum(1 for e in entries if e.is_rewatch),
        "averageRating": round(sum(rated) / len(rated), 2) if rated else None,
        "ratedCount": len(rated),
        # Counts only films whose runtime TMDB gave us, so this reads low rather
        # than invented when the catalog is thin.
        "hoursWatched": round(minutes / 60, 1),
    }


async def runtime_minutes(
    db: AsyncSession, user_id: str, *, viewer_is_owner: bool, bounds: tuple[date, date] | None
) -> int:
    """Total minutes watched, counting only films with a known runtime."""
    stmt = (
        select(func.coalesce(func.sum(Movie.runtime), 0))
        .select_from(DiaryEntry)
        .join(Movie, DiaryEntry.movie_id == Movie.id)
        .where(DiaryEntry.user_id == user_id)
    )
    if not viewer_is_owner:
        stmt = stmt.where(DiaryEntry.visibility == "public")
    if bounds:
        stmt = stmt.where(DiaryEntry.watched_on >= bounds[0], DiaryEntry.watched_on <= bounds[1])
    return int((await db.execute(stmt)).scalar_one() or 0)


async def counts(db: AsyncSession, user_id: str) -> dict:
    """Library sizes — the numbers under the Passport header."""
    async def one(stmt) -> int:
        return int((await db.execute(stmt)).scalar_one() or 0)

    return {
        "ratings": await one(select(func.count()).select_from(Rating).where(Rating.user_id == user_id)),
        "reviews": await one(select(func.count()).select_from(Review).where(Review.user_id == user_id)),
        "watchlist": await one(
            select(func.count()).select_from(WatchlistItem).where(WatchlistItem.user_id == user_id)
        ),
    }


async def top_people(
    db: AsyncSession,
    user_id: str,
    *,
    viewer_is_owner: bool,
    bounds: tuple[date, date] | None = None,
    limit: int = 5,
) -> dict:
    """Most-watched directors and actors, from the cached TMDB credits.

    Counted per *viewing*, so a director you rewatch often outranks one you saw
    once — which is what "most watched" should mean.
    """
    stmt = (
        select(DiaryEntry, Movie)
        .join(Movie, DiaryEntry.movie_id == Movie.id)
        .where(DiaryEntry.user_id == user_id)
    )
    if not viewer_is_owner:
        stmt = stmt.where(DiaryEntry.visibility == "public")
    if bounds:
        stmt = stmt.where(DiaryEntry.watched_on >= bounds[0], DiaryEntry.watched_on <= bounds[1])

    directors: Counter = Counter()
    actors: Counter = Counter()
    meta: dict[int, dict] = {}

    for _entry, movie in (await db.execute(stmt)).all():
        credits = movie.credits or {}
        for c in credits.get("crew") or []:
            if c.get("job") == "Director" and c.get("id"):
                directors[c["id"]] += 1
                meta.setdefault(c["id"], {"name": c.get("name"), "profilePath": c.get("profile_path")})
        # Billed cast only — counting the full cast list makes extras outrank leads.
        for c in (credits.get("cast") or [])[:5]:
            if c.get("id"):
                actors[c["id"]] += 1
                meta.setdefault(c["id"], {"name": c.get("name"), "profilePath": c.get("profile_path")})

    def top(counter: Counter) -> list[dict]:
        return [
            {"tmdbId": pid, "count": n, **meta.get(pid, {"name": None, "profilePath": None})}
            for pid, n in counter.most_common(limit)
        ]

    return {"directors": top(directors), "actors": top(actors)}


async def top_films(
    db: AsyncSession,
    user_id: str,
    *,
    viewer_is_owner: bool,
    bounds: tuple[date, date] | None = None,
    limit: int = 10,
) -> list[dict]:
    """Highest-rated viewings in the window, best first."""
    stmt = (
        select(DiaryEntry, Movie)
        .join(Movie, DiaryEntry.movie_id == Movie.id)
        .where(DiaryEntry.user_id == user_id, DiaryEntry.rating.is_not(None))
    )
    if not viewer_is_owner:
        stmt = stmt.where(DiaryEntry.visibility == "public")
    if bounds:
        stmt = stmt.where(DiaryEntry.watched_on >= bounds[0], DiaryEntry.watched_on <= bounds[1])
    stmt = stmt.order_by(DiaryEntry.rating.desc(), DiaryEntry.watched_on.desc()).limit(limit)

    return [
        {**film_payload(movie), "rating": entry.rating, "watchedOn": entry.watched_on.isoformat()}
        for entry, movie in (await db.execute(stmt)).all()
    ]


async def active_years(db: AsyncSession, user_id: str, *, viewer_is_owner: bool) -> list[int]:
    """Descending years the user logged anything in — drives the year picker."""
    stmt = select(func.distinct(func.extract("year", DiaryEntry.watched_on))).where(
        DiaryEntry.user_id == user_id
    )
    if not viewer_is_owner:
        stmt = stmt.where(DiaryEntry.visibility == "public")
    return sorted((int(y) for y in (await db.execute(stmt)).scalars().all()), reverse=True)
