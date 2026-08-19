"""Search — films and people.

Search is one of Kaset's four primary destinations and the entry point into
discovery (KASET.md §8). This module owns the lookup itself; the discovery
modules that fill the rest of the Search page arrive in Phase 7, and
personalised ranking in Phase 8.

Relevance today is deliberately transparent and explainable: exact-title match
dominates, then popularity, community activity, and recency. No learned model.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.shared.models.actions import Rating, WatchHistory
from app.shared.models.movie import Movie
from app.shared.models.social import Follow
from app.shared.models.user import User

router = APIRouter(prefix="/api/search", tags=["search"])


def _title_match(name: str, query: str) -> float:
    n = (name or "").strip().lower()
    q = query.strip().lower()
    if n == q:
        return 1000.0
    if n.startswith(q):
        return 500.0
    if q in n:
        return 100.0
    return 0.0


def _recency(year: str | None) -> float:
    if not year or not year.isdigit():
        return 0.0
    # 0..30 points: newer scores higher, flat before 1990.
    return max(0.0, min((int(year) - 1990) / 35.0, 1.0)) * 30.0


@router.get("/films")
async def search_films(
    q: str = Query(..., min_length=1),
    _user: User = Depends(get_current_user),
):
    """Relevance-ranked film results for the search field."""
    try:
        films = (await tmdb.search_movies(q)).get("results") or []
    except Exception:  # noqa: BLE001 - a TMDB outage yields no results, not a 500
        films = []

    def build(raw: dict) -> dict:
        name = raw.get("title") or ""
        year = (raw.get("release_date") or "")[:4] or None
        score = (
            _title_match(name, q)
            + min(raw.get("popularity") or 0.0, 400.0) / 4.0
            + min(raw.get("vote_count") or 0, 4000) / 100.0
            + _recency(year)
        )
        return {
            "tmdbId": raw["id"],
            "title": name,
            "posterPath": raw.get("poster_path"),
            "year": year,
            "_score": score,
        }

    out = [build(f) for f in films if f.get("id")]
    out.sort(key=lambda r: r["_score"], reverse=True)
    for r in out:
        r.pop("_score", None)
    return {"results": out[:25]}


@router.get("/people")
async def search_people(
    q: str = Query(..., min_length=1),
    _user: User = Depends(get_current_user),
):
    """Cast and crew results — the other half of Kaset search."""
    try:
        people = (await tmdb.search_people(q)).get("results") or []
    except Exception:  # noqa: BLE001
        people = []

    results = []
    for p in people:
        if not p.get("id"):
            continue
        known_for = [
            k.get("title")
            for k in (p.get("known_for") or [])
            if k.get("media_type") == "movie" and k.get("title")
        ]
        results.append(
            {
                "tmdbId": p["id"],
                "name": p.get("name") or "",
                "profilePath": p.get("profile_path"),
                "department": p.get("known_for_department"),
                "knownFor": known_for[:3],
            }
        )
    return {"results": results[:20]}


@router.get("/popular-among-following")
async def popular_among_following(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Films the people you follow have logged or rated in the last 90 days."""
    following_ids = (
        await db.execute(
            select(Follow.following_id).where(Follow.follower_id == user.id)
        )
    ).scalars().all()
    if not following_ids:
        return {"results": []}

    since = datetime.now(timezone.utc) - timedelta(days=90)
    counts: dict[str, int] = {}
    for table, ts_col in ((WatchHistory, WatchHistory.watched_at), (Rating, Rating.created_at)):
        rows = (
            await db.execute(
                select(table.movie_id, func.count())
                .where(table.user_id.in_(following_ids), ts_col >= since)
                .group_by(table.movie_id)
            )
        ).all()
        for movie_id, c in rows:
            counts[movie_id] = counts.get(movie_id, 0) + c
    if not counts:
        return {"results": []}

    top_ids = sorted(counts, key=lambda mid: counts[mid], reverse=True)[:12]
    films = (
        await db.execute(select(Movie).where(Movie.id.in_(top_ids)))
    ).scalars().all()
    by_id = {m.id: m for m in films}

    return {
        "results": [
            {
                "tmdbId": m.tmdb_id,
                "title": m.title,
                "posterPath": m.poster_path,
                "year": (m.release_date or "")[:4] or None,
            }
            for mid in top_ids
            if (m := by_id.get(mid)) is not None
        ]
    }
