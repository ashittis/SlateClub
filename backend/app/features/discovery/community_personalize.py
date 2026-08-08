"""Personalization layer for the Community Intelligence Engine.

Takes the shared, web-sourced community consensus pool for a seed film and
re-ranks it through THIS user's Cinema DNA (their 25-dim taste vector), then
explains the difference — "most people put Good Time first, but your taste leans
toward Nightcrawler."

Per-user and cheap: computed at request time from the cached community pool, so
nothing here is persisted. Reuses the exact taste primitives the /for-you
pipeline uses (compute_user_taste_vector + cosine_similarity), so a user's
consensus re-rank is consistent with the rest of their recommendations.
"""

from __future__ import annotations

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.embeddings.taste_vector import (
    compute_user_taste_vector,
    cosine_similarity,
    movie_to_embedding,
    rating_signal,
)
from app.shared.models.actions import Rating, WatchlistItem
from app.shared.models.movie import Movie
from app.shared.models.onboarding import FavoriteMovie
from app.shared.models.user import User

# How much the user's taste pulls against the crowd's consensus in the final
# order. 0 = pure community; 1 = pure personal. 0.45 keeps community consensus
# the backbone while letting taste meaningfully re-order.
_TASTE_WEIGHT = 0.45


def _emb_input(m: Movie) -> dict:
    """The subset of Movie fields movie_to_embedding() reads."""
    return {
        "id": m.id,
        "genres": m.genres,
        "vote_average": m.vote_average,
        "popularity": m.popularity,
        "runtime": m.runtime,
        "release_date": m.release_date,
        "original_language": m.original_language,
    }


async def user_taste_vector(db: AsyncSession, user: User) -> np.ndarray | None:
    """Build the user's 25-dim taste vector from ratings + watchlist + favourites,
    anchored by their onboarding seed prior. Returns None when we have no signal
    at all (so the caller can skip personalization and serve community order)."""
    interactions: list[dict] = []

    ratings = (
        await db.execute(
            select(Rating, Movie)
            .join(Movie, Rating.movie_id == Movie.id)
            .where(Rating.user_id == user.id)
        )
    ).all()
    for rating, movie in ratings:
        interactions.append({
            "movie_data": _emb_input(movie),
            "signal_type": rating_signal(rating.value),
            "created_at": rating.created_at,
        })

    watchlist = (
        await db.execute(
            select(WatchlistItem, Movie)
            .join(Movie, WatchlistItem.movie_id == Movie.id)
            .where(WatchlistItem.user_id == user.id)
        )
    ).all()
    for wl_item, movie in watchlist:
        interactions.append({
            "movie_data": _emb_input(movie),
            "signal_type": "watchlisted",
            "created_at": wl_item.created_at,
        })

    favourites = (
        await db.execute(
            select(FavoriteMovie, Movie)
            .outerjoin(Movie, Movie.tmdb_id == FavoriteMovie.tmdb_id)
            .where(FavoriteMovie.user_id == user.id)
        )
    ).all()
    for fav, movie in favourites:
        movie_data = _emb_input(movie) if movie is not None else {
            "id": f"fav_{fav.tmdb_id}", "genres": [], "vote_average": 8.0,
            "popularity": 100, "runtime": 120, "release_date": "",
            "original_language": "en",
        }
        interactions.append({
            "movie_data": movie_data,
            "signal_type": "favorite",
            "created_at": fav.created_at,
        })

    # Onboarding prior (languages + mood sliders + poster picks). Late import to
    # avoid a slice-level import cycle with the recommendation feature.
    from app.features.recommendation.recommendations import load_user_priors

    priors = await load_user_priors(str(user.id), db)
    seed_prior = priors.get("seed_prior")

    has_prior = seed_prior is not None and bool(np.any(seed_prior))
    if not interactions and not has_prior:
        return None

    vec = compute_user_taste_vector(interactions, seed_prior=seed_prior)
    return vec if np.any(vec) else None


def personalize(
    candidates: list[dict],
    taste_vec: np.ndarray | None,
    movies_by_tmdb: dict[int, Movie],
) -> dict:
    """Re-rank the community `candidates` by the user's taste and build a
    "for you" callout comparing the crowd's top pick to the personalized one.

    Returns {personalized: [candidate...], forYou: {...}|None}. When taste_vec is
    None (cold-start user), personalized mirrors community order and forYou is
    None — the panel then simply shows community consensus.
    """
    if taste_vec is None or not candidates:
        return {"personalized": list(candidates), "forYou": None}

    top_raw = max((c.get("rawScore", 0.0) for c in candidates), default=0.0) or 1.0
    scored: list[tuple[dict, float]] = []
    for c in candidates:
        movie = movies_by_tmdb.get(c["tmdbId"])
        taste_sim = 0.0
        if movie is not None:
            taste_sim = max(0.0, cosine_similarity(
                taste_vec, movie_to_embedding(_emb_input(movie))
            ))
        community_norm = (c.get("rawScore", 0.0) / top_raw)
        blended = (1 - _TASTE_WEIGHT) * community_norm + _TASTE_WEIGHT * taste_sim
        c = {**c, "tasteSim": round(taste_sim, 3)}
        scored.append((c, blended))

    scored.sort(key=lambda t: -t[1])
    personalized = [c for c, _ in scored]

    community_top = candidates[0]
    personal_top = personalized[0]
    if personal_top["tmdbId"] == community_top["tmdbId"]:
        headline = (
            f"Your taste lines up with the crowd — {personal_top['title']} "
            "tops both."
        )
    else:
        headline = (
            f"Most people put {community_top['title']} first, but based on your "
            f"Cinema DNA we think you'll prefer {personal_top['title']}."
        )
    return {
        "personalized": personalized,
        "forYou": {
            "headline": headline,
            "communityTopTmdbId": community_top["tmdbId"],
            "personalTopTmdbId": personal_top["tmdbId"],
        },
    }
