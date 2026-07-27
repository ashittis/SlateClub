"""Taste-signal side effects for watching and rating a film.

Both the standalone routers (`routes/watch_history.py`, `routes/ratings.py`)
and the film-page slug wrappers (`routes/movies.py`) and the diary router
(`routes/diary.py`) need to fire the same graph-hydration / contextual-bandit /
taste-embedding effects when a user watches or rates. Historically this logic
lived inline in the two standalone routers, so the slug wrappers (which the UI
actually calls) never fired it. These two helpers are the single home for it.

Every branch is defensively wrapped: a signal failure must never fail the
user-facing write.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.llm.contextual_bandit import bandit
from app.shared.models.actions import Rating
from app.shared.models.movie import Movie
from app.shared.models.social import Follow, Impression
from app.shared.models.user import User
from app.shared.services.taste_cache import invalidate_user_taste_vector


async def _recent_impression(db: AsyncSession, user_id: str, movie_id: str):
    """Most recent sourced impression of this movie in the last 7 days, if any."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(
        select(Impression)
        .where(
            Impression.user_id == user_id,
            Impression.movie_id == movie_id,
            Impression.shown_at >= cutoff,
            Impression.source.isnot(None),
        )
        .order_by(Impression.shown_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _bandit_segment(db: AsyncSession, user: User) -> str:
    n_ratings = (
        await db.execute(select(func.count(Rating.id)).where(Rating.user_id == user.id))
    ).scalar_one() or 0
    n_follows = (
        await db.execute(select(func.count(Follow.id)).where(Follow.follower_id == user.id))
    ).scalar_one() or 0
    days = max((datetime.now(timezone.utc) - user.created_at).days, 0)
    return bandit.classify_user(n_ratings, n_follows, days)


async def record_watch_signals(
    db: AsyncSession, user: User, movie: Movie, completion_pct: float
) -> None:
    """Graph hydration + contextual-bandit reward + taste-vector invalidation
    for a watch. `movie` must already be loaded; `completion_pct` is 0–100."""
    # ── Graph hydration ────────────────────────────────────────────────
    try:
        from app.ml.graph import taste_graph

        genre_names = [
            g.get("name", "") for g in (movie.genres or []) if isinstance(g, dict)
        ]
        await taste_graph.upsert_movie_node(
            movie.id, movie.tmdb_id or 0, movie.title or "", genre_names
        )
        await taste_graph.upsert_user_node(user.id, user.name, user.username)
        await taste_graph.set_user_watched(user.id, movie.id, weight=completion_pct / 100.0)
    except Exception as exc:
        print(f"[watch-signals] graph hydration failed: {exc}")

    # ── Contextual bandit reward ───────────────────────────────────────
    try:
        impression = await _recent_impression(db, user.id, movie.id)
        if impression:
            segment = await _bandit_segment(db, user)
            bandit.record_reward(
                segment,
                impression.source,
                clicked=True,
                watch_through=completion_pct / 100.0,
                rating=None,
            )
    except Exception as exc:
        print(f"[watch-signals] bandit reward failed: {exc}")

    await invalidate_user_taste_vector(user.id)


async def record_rating_signals(
    db: AsyncSession, user: User, movie: Movie, value: float, is_new: bool
) -> None:
    """Graph hydration + pairwise similarity + bandit reward + taste-embedding
    refresh + taste-vector invalidation for a rating."""
    # ── Graph hydration ────────────────────────────────────────────────
    try:
        from app.ml.graph import taste_graph

        genre_names = [
            g.get("name", "") for g in (movie.genres or []) if isinstance(g, dict)
        ]
        await taste_graph.upsert_movie_node(
            movie.id, movie.tmdb_id or 0, movie.title or "", genre_names
        )
        await taste_graph.upsert_user_node(user.id, user.name, user.username)
        await taste_graph.set_user_rated(user.id, movie.id, value)
    except Exception as exc:
        print(f"[rating-signals] graph hydration failed: {exc}")

    # ── Pairwise taste similarity (cheap at <100 users) ────────────────
    try:
        from app.ml.graph import taste_graph as tg
        from app.ml.embeddings.taste_vector import (
            compute_user_taste_vector,
            cosine_similarity,
            rating_signal,
        )

        all_user_ids = (await db.execute(select(User.id))).scalars().all()
        if 1 < len(all_user_ids) <= 100:
            all_rating_rows = (
                await db.execute(
                    select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id)
                )
            ).all()
            user_interaction_map: dict[str, list] = {}
            for r, m in all_rating_rows:
                user_interaction_map.setdefault(r.user_id, []).append({
                    "movie_data": {
                        "genres": m.genres, "vote_average": m.vote_average,
                        "popularity": m.popularity, "runtime": m.runtime,
                        "release_date": m.release_date, "original_language": m.original_language,
                    },
                    "signal_type": rating_signal(r.value),
                    "created_at": r.created_at,
                })
            current_vec = compute_user_taste_vector(user_interaction_map.get(user.id, []))
            import numpy as np

            if np.any(current_vec):
                for other_id in all_user_ids:
                    if other_id == user.id:
                        continue
                    other_interactions = user_interaction_map.get(other_id, [])
                    if not other_interactions:
                        continue
                    other_vec = compute_user_taste_vector(other_interactions)
                    sim = cosine_similarity(current_vec, other_vec)
                    if sim >= 0.7:
                        await tg.set_taste_similar(user.id, other_id, sim)
                        await tg.set_taste_similar(other_id, user.id, sim)
    except Exception as exc:
        print(f"[rating-signals] pairwise similarity failed: {exc}")

    # ── Contextual bandit reward ───────────────────────────────────────
    try:
        impression = await _recent_impression(db, user.id, movie.id)
        if impression:
            segment = await _bandit_segment(db, user)
            bandit.record_reward(
                segment,
                impression.source,
                clicked=True,
                watch_through=0.0,
                rating=value,
            )
    except Exception as exc:
        print(f"[rating-signals] bandit reward failed: {exc}")

    # ── Taste embedding refresh ────────────────────────────────────────
    # Fire on any new rating once the user has ≥5 total AND has no embedding
    # yet — handles both new accounts hitting their 5th rating and older
    # accounts that predate this feature.
    if is_new:
        try:
            from app.shared.models.user import UserTasteState
            from app.shared.services.taste_embedding import refresh_taste_embedding

            n_total = (
                await db.execute(
                    select(func.count(Rating.id)).where(Rating.user_id == user.id)
                )
            ).scalar_one() or 0
            if n_total >= 5:
                taste_state = (
                    await db.execute(
                        select(UserTasteState).where(UserTasteState.user_id == user.id)
                    )
                ).scalar_one_or_none()
                if taste_state is None or taste_state.taste_embedding is None:
                    await refresh_taste_embedding(user.id, db)
        except Exception as exc:
            print(f"[rating-signals] taste embedding refresh failed: {exc}")

    await invalidate_user_taste_vector(user.id)
