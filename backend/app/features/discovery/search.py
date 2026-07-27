"""Unified title search — Spotify-style single mixed feed.

Movies and series compete in one relevance-ranked pool (no separate sections),
so the user finds the most relevant title regardless of media type. Ranking
blends exact-title match, popularity, the user's taste relevance, community
activity, and recency.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.ml.embeddings.taste_vector import cosine_similarity, movie_to_embedding
from app.shared.models.actions import Rating, WatchHistory
from app.shared.models.movie import Movie
from app.features.slates.models import Slate, SlateCollaborator, SlateFilm
from app.shared.models.social import Follow
from app.shared.models.user import User
from app.shared.services.taste_cache import get_user_taste_vector

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
    # 0..~30 points: newer = higher, flat before 1990.
    return max(0.0, min((int(year) - 1990) / 35.0, 1.0)) * 30.0


async def _user_slate_keys(db: AsyncSession, user_id: str) -> set[tuple[int, str]]:
    """All (tmdb_id, media_type) the user has across own + collaborative slates."""
    slate_ids = (
        await db.execute(
            select(Slate.id).where(
                (Slate.creator_id == user_id)
                | (
                    Slate.id.in_(
                        select(SlateCollaborator.slate_id).where(
                            SlateCollaborator.user_id == user_id
                        )
                    )
                )
            )
        )
    ).scalars().all()
    if not slate_ids:
        return set()
    rows = (
        await db.execute(
            select(SlateFilm.tmdb_id, SlateFilm.media_type).where(
                SlateFilm.slate_id.in_(slate_ids)
            )
        )
    ).all()
    return {(tid, mt) for tid, mt in rows}


@router.get("/titles")
async def search_titles(
    q: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One mixed, relevance-ranked list of films + series."""
    try:
        movies = (await tmdb.search_movies(q)).get("results") or []
    except Exception:  # noqa: BLE001
        movies = []
    try:
        series = (await tmdb.search_tv(q)).get("results") or []
    except Exception:  # noqa: BLE001
        series = []

    user_vec = await get_user_taste_vector(user.id, db)

    def build(raw: dict, media_type: str) -> dict:
        name = (raw.get("title") if media_type == "movie" else raw.get("name")) or ""
        rel = (
            raw.get("release_date") if media_type == "movie" else raw.get("first_air_date")
        ) or ""
        year = rel[:4] or None
        emb = movie_to_embedding(
            {
                "genres": [{"id": g} for g in (raw.get("genre_ids") or [])],
                "vote_average": raw.get("vote_average"),
                "popularity": raw.get("popularity"),
                "release_date": rel,
                "original_language": raw.get("original_language"),
            }
        )
        taste = max(0.0, cosine_similarity(user_vec, emb))  # 0..1
        score = (
            _title_match(name, q)
            + min(raw.get("popularity") or 0.0, 400.0) / 4.0  # popularity
            + taste * 80.0  # user taste relevance
            + min(raw.get("vote_count") or 0, 4000) / 100.0  # community activity
            + _recency(year)
        )
        return {
            "tmdbId": raw["id"],
            "mediaType": media_type,
            "title": name,
            "posterPath": raw.get("poster_path"),
            "year": year,
            "_score": score,
        }

    out = [build(m, "movie") for m in movies if m.get("id")]
    out += [build(s, "tv") for s in series if s.get("id")]
    out.sort(key=lambda r: r["_score"], reverse=True)
    out = out[:25]

    # Cached-series season count for the "Series • N Seasons" metadata line.
    tv_ids = [r["tmdbId"] for r in out if r["mediaType"] == "tv"]
    if tv_ids:
        rows = (
            await db.execute(
                select(Movie.tmdb_id, Movie.number_of_seasons).where(
                    Movie.media_type == "tv", Movie.tmdb_id.in_(tv_ids)
                )
            )
        ).all()
        seasons = {tid: n for tid, n in rows}
        for r in out:
            if r["mediaType"] == "tv":
                r["numberOfSeasons"] = seasons.get(r["tmdbId"])

    # Flag titles already in one of the user's slates → search shows a checkmark.
    slate_keys = await _user_slate_keys(db, user.id)
    for r in out:
        r["inSlate"] = (r["tmdbId"], r["mediaType"]) in slate_keys
        r.pop("_score", None)

    return {"results": out}


@router.get("/popular-in-orbit")
async def popular_in_orbit(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Titles the user's orbit (mutual follows) engaged with recently."""
    orbit_ids = (
        await db.execute(
            select(Follow.following_id)
            .where(Follow.follower_id == user.id)
            .intersect(
                select(Follow.follower_id).where(Follow.following_id == user.id)
            )
        )
    ).scalars().all()
    if not orbit_ids:
        return {"results": []}

    since = datetime.now(timezone.utc) - timedelta(days=90)
    counts: dict[str, int] = {}
    for table, ts_col in ((WatchHistory, WatchHistory.watched_at), (Rating, Rating.created_at)):
        rows = (
            await db.execute(
                select(table.movie_id, func.count())
                .where(table.user_id.in_(orbit_ids), ts_col >= since)
                .group_by(table.movie_id)
            )
        ).all()
        for movie_id, c in rows:
            counts[movie_id] = counts.get(movie_id, 0) + c
    if not counts:
        return {"results": []}

    top_ids = sorted(counts, key=lambda mid: counts[mid], reverse=True)[:12]
    movies = (
        await db.execute(select(Movie).where(Movie.id.in_(top_ids)))
    ).scalars().all()
    by_id = {m.id: m for m in movies}
    results = []
    for mid in top_ids:
        m = by_id.get(mid)
        if not m:
            continue
        results.append(
            {
                "tmdbId": m.tmdb_id,
                "mediaType": m.media_type,
                "title": m.title,
                "posterPath": m.poster_path,
                "year": (m.release_date or "")[:4] or None,
                "numberOfSeasons": m.number_of_seasons,
            }
        )
    return {"results": results}
