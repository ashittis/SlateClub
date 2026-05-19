from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..ml.llm.contextual_bandit import bandit
from ..models.actions import Rating
from ..models.movie import Movie
from ..models.social import Follow, Impression
from ..models.user import User
from ..services.taste_embedding import refresh_taste_embedding

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


# ── Schemas ──────────────────────────────────────────────────

class RatingCreate(BaseModel):
    movie_id: str = Field(..., alias="movieId")
    value: float = Field(..., ge=0.5, le=5.0)

    class Config:
        populate_by_name = True


class RatingResponse(BaseModel):
    id: str
    user_id: str
    movie_id: str
    value: float

    class Config:
        from_attributes = True


class RatingWithMovie(RatingResponse):
    movie: dict | None = None


# ── Routes ───────────────────────────────────────────────────

@router.post("/", response_model=RatingResponse)
async def rate_movie(
    body: RatingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify movie exists
    movie_result = await db.execute(select(Movie).where(Movie.id == body.movie_id))
    movie_obj = movie_result.scalar_one_or_none()
    if not movie_obj:
        raise HTTPException(status_code=404, detail="Movie not found in database")

    # Upsert
    result = await db.execute(
        select(Rating).where(Rating.user_id == user.id, Rating.movie_id == body.movie_id)
    )
    rating = result.scalar_one_or_none()
    is_new = rating is None

    if rating:
        rating.value = body.value
    else:
        rating = Rating(user_id=user.id, movie_id=body.movie_id, value=body.value)
        db.add(rating)

    await db.flush()

    # ── Graph hydration ─────────────────────────────────────────────────
    try:
        from ..ml.graph import taste_graph
        genre_names = [
            g.get("name", "") for g in (movie_obj.genres or []) if isinstance(g, dict)
        ]
        await taste_graph.upsert_movie_node(
            movie_obj.id, movie_obj.tmdb_id or 0, movie_obj.title or "", genre_names
        )
        await taste_graph.upsert_user_node(user.id, user.name, user.username)
        await taste_graph.set_user_rated(user.id, body.movie_id, body.value)
    except Exception as exc:
        print(f"[ratings] graph hydration failed: {exc}")

    # ── Pairwise taste similarity (cheap at <50 users) ─────────────────
    try:
        from ..ml.graph import taste_graph as tg
        from ..ml.embeddings.taste_vector import compute_user_taste_vector, cosine_similarity

        all_user_ids = (await db.execute(select(User.id))).scalars().all()
        if 1 < len(all_user_ids) <= 100:
            all_rating_rows = (
                await db.execute(
                    select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id)
                )
            ).all()
            user_interaction_map: dict[str, list] = {}
            for r, m in all_rating_rows:
                uid = r.user_id
                user_interaction_map.setdefault(uid, []).append({
                    "movie_data": {
                        "genres": m.genres, "vote_average": m.vote_average,
                        "popularity": m.popularity, "runtime": m.runtime,
                        "release_date": m.release_date, "original_language": m.original_language,
                    },
                    "signal_type": f"rating_{min(int(r.value), 5)}",
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
        print(f"[ratings] pairwise similarity failed: {exc}")

    # ── Contextual bandit reward ────────────────────────────────────────
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        imp_result = await db.execute(
            select(Impression)
            .where(
                Impression.user_id == user.id,
                Impression.movie_id == body.movie_id,
                Impression.shown_at >= cutoff,
                Impression.source.isnot(None),
            )
            .order_by(Impression.shown_at.desc())
            .limit(1)
        )
        impression = imp_result.scalar_one_or_none()
        if impression:
            n_ratings = (
                await db.execute(
                    select(func.count(Rating.id)).where(Rating.user_id == user.id)
                )
            ).scalar_one() or 0
            n_follows = (
                await db.execute(
                    select(func.count(Follow.id)).where(Follow.follower_id == user.id)
                )
            ).scalar_one() or 0
            days = max((datetime.now(timezone.utc) - user.created_at).days, 0)
            segment = bandit.classify_user(n_ratings, n_follows, days)
            bandit.record_reward(
                segment,
                impression.source,
                clicked=True,
                watch_through=0.0,
                rating=body.value,
            )
    except Exception as exc:
        print(f"[ratings] bandit reward failed: {exc}")

    # ── Taste embedding refresh ─────────────────────────────────────────
    # Fire on any new rating once the user has ≥5 total AND has no
    # embedding yet. The ">= 5 and no embedding" condition handles both
    # new accounts hitting their 5th rating AND existing accounts that
    # already have many ratings but were created before this feature.
    if is_new:
        try:
            n_total = (
                await db.execute(
                    select(func.count(Rating.id)).where(Rating.user_id == user.id)
                )
            ).scalar_one() or 0
            if n_total >= 5:
                from ..models.user import UserTasteState
                taste_state = (
                    await db.execute(
                        select(UserTasteState).where(UserTasteState.user_id == user.id)
                    )
                ).scalar_one_or_none()
                if taste_state is None or taste_state.taste_embedding is None:
                    await refresh_taste_embedding(user.id, db)
        except Exception as exc:
            print(f"[ratings] taste embedding refresh failed: {exc}")

    return rating


@router.get("/{movie_id}", response_model=RatingResponse | None)
async def get_rating(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Rating).where(Rating.user_id == user.id, Rating.movie_id == movie_id)
    )
    rating = result.scalar_one_or_none()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    return rating


@router.get("/", response_model=list[RatingWithMovie])
async def get_all_ratings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Rating, Movie)
        .join(Movie, Rating.movie_id == Movie.id)
        .where(Rating.user_id == user.id)
        .order_by(Rating.updated_at.desc())
    )
    rows = result.all()
    return [
        RatingWithMovie(
            id=r.id,
            user_id=r.user_id,
            movie_id=r.movie_id,
            value=r.value,
            movie={
                "id": m.id,
                "tmdb_id": m.tmdb_id,
                "title": m.title,
                "poster_path": m.poster_path,
                "release_date": m.release_date,
            },
        )
        for r, m in rows
    ]


@router.delete("/{movie_id}")
async def delete_rating(
    movie_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Rating).where(Rating.user_id == user.id, Rating.movie_id == movie_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Rating not found")
    return {"ok": True}
