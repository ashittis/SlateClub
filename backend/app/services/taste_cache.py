"""
Cached per-user taste vectors.

The 25-dim taste vector (Section 1.2) is the expensive, reused unit behind
Match Cut and other personalization. We cache it in Redis keyed by user, with
a short TTL backstop and explicit invalidation on signal-affecting writes
(ratings / watch / watchlist). All Redis access is best-effort: any miss or
error falls back to live computation.
"""

from __future__ import annotations

import json

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.redis_client import _k, get_redis
from ..ml.embeddings.taste_vector import compute_user_taste_vector, rating_signal
from ..models.actions import Rating, WatchHistory, WatchlistItem
from ..models.movie import Movie
from ..models.onboarding import FavoriteMovie

_TTL_SECONDS = 900  # 15 min backstop for any signal not explicitly invalidated


def _vector_key(user_id: str) -> str:
    return _k(f"taste_vec:{user_id}")


def _embedding_dict(movie: Movie) -> dict:
    """Minimal movie dict for `movie_to_embedding` + result rendering."""
    return {
        "id": movie.id,
        "tmdb_id": movie.tmdb_id,
        "title": movie.title,
        "poster_path": movie.poster_path,
        "release_date": movie.release_date,
        "vote_average": movie.vote_average,
        "popularity": movie.popularity,
        "runtime": movie.runtime,
        "original_language": movie.original_language,
        "genres": movie.genres,
    }


async def _user_interactions(db: AsyncSession, user_id: str) -> list[dict]:
    """Build the interactions list `compute_user_taste_vector` expects."""
    interactions: list[dict] = []

    rated = (
        await db.execute(
            select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id).where(
                Rating.user_id == user_id
            )
        )
    ).all()
    for r, m in rated:
        interactions.append({
            "movie_data": _embedding_dict(m),
            "signal_type": rating_signal(r.value),
            "created_at": r.created_at,
        })

    watched = (
        await db.execute(
            select(WatchHistory, Movie)
            .join(Movie, WatchHistory.movie_id == Movie.id)
            .where(WatchHistory.user_id == user_id)
        )
    ).all()
    for wh, m in watched:
        interactions.append({
            "movie_data": _embedding_dict(m),
            "signal_type": "watched",
            "created_at": wh.watched_at,
        })

    shelved = (
        await db.execute(
            select(WatchlistItem, Movie)
            .join(Movie, WatchlistItem.movie_id == Movie.id)
            .where(WatchlistItem.user_id == user_id)
        )
    ).all()
    for wl, m in shelved:
        interactions.append({
            "movie_data": _embedding_dict(m),
            "signal_type": "watchlisted",
            "created_at": wl.created_at,
        })

    favs = (
        await db.execute(
            select(FavoriteMovie, Movie)
            .outerjoin(Movie, Movie.tmdb_id == FavoriteMovie.tmdb_id)
            .where(FavoriteMovie.user_id == user_id)
        )
    ).all()
    for fav, m in favs:
        movie_data = _embedding_dict(m) if m is not None else {
            "id": f"fav_{fav.tmdb_id}", "genres": [], "vote_average": 8.0,
            "popularity": 100, "runtime": 120, "release_date": "",
            "original_language": "en",
        }
        interactions.append({
            "movie_data": movie_data,
            "signal_type": "favorite",
            "created_at": fav.created_at,
        })

    return interactions


async def get_user_taste_vector(user_id: str, db: AsyncSession) -> np.ndarray:
    """25-dim taste vector for a user — Redis-cached, with live fallback."""
    key = _vector_key(user_id)
    r = await get_redis()

    if r is not None:
        try:
            cached = await r.get(key)
            if cached:
                return np.array(json.loads(cached), dtype=np.float32)
        except Exception as exc:
            print(f"[taste_cache] read failed: {exc}")

    vec = compute_user_taste_vector(await _user_interactions(db, user_id))

    if r is not None:
        try:
            await r.set(key, json.dumps(vec.tolist()), ex=_TTL_SECONDS)
        except Exception as exc:
            print(f"[taste_cache] write failed: {exc}")

    return vec


async def invalidate_user_taste_vector(user_id: str) -> None:
    """Drop a user's cached taste vector (no-op when Redis is unavailable)."""
    r = await get_redis()
    if r is None:
        return
    try:
        await r.delete(_vector_key(user_id))
    except Exception as exc:
        print(f"[taste_cache] invalidate failed: {exc}")
