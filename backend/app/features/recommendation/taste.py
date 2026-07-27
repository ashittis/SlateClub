"""
Taste API — Phase 5
Taste Identity Profile, Taste Drift, LLM taste descriptions, Contextual Bandit.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.user import User
from app.shared.models.movie import Movie
from app.shared.models.actions import Rating, Review
from app.shared.models.onboarding import FavoritePerson
from app.ml.llm.taste_identity import compute_taste_identity
from app.ml.llm.taste_describer import extract_tone_tags
from app.ml.llm.drift_detector import compute_drift_score, get_drift_adaptations
from app.ml.llm.contextual_bandit import bandit
from app.ml.graph.taste_graph import get_user_clusters
from app.ml.embeddings.taste_vector import movie_to_embedding, compute_user_taste_vector, rating_signal

router = APIRouter(prefix="/api/taste", tags=["taste"])


@router.get("/identity")
async def taste_identity(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's Taste Identity Profile (Section 1.4)."""
    # Gather data
    ratings_result = await db.execute(
        select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id).where(Rating.user_id == user.id)
    )
    ratings_raw = ratings_result.all()
    ratings = [
        {
            "value": r.value,
            "movie_title": m.title,
            "genres": m.genres,
            "credits": m.credits,
            "created_at": r.created_at,
        }
        for r, m in ratings_raw
    ]

    reviews_result = await db.execute(
        select(Review, Movie).join(Movie, Review.movie_id == Movie.id).where(Review.user_id == user.id)
    )
    reviews = [
        {"movie_title": m.title, "body": r.body}
        for r, m in reviews_result.all()
    ]

    fav_people_result = await db.execute(
        select(FavoritePerson).where(FavoritePerson.user_id == user.id)
    )
    fav_people = [
        {"name": p.name, "known_for": p.known_for, "tmdb_id": p.tmdb_id}
        for p in fav_people_result.scalars().all()
    ]

    clusters = await get_user_clusters(user.id)

    identity = await compute_taste_identity(
        user_id=user.id,
        ratings=ratings,
        reviews=reviews,
        favorite_people=fav_people,
        clusters=clusters,
    )

    return {"identity": identity}


@router.get("/drift")
async def taste_drift(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check for taste drift (Section 1.2 + 1.6)."""
    ratings_result = await db.execute(
        select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id).where(Rating.user_id == user.id)
    )

    interactions = []
    for r, m in ratings_result.all():
        interactions.append({
            "movie_data": {
                "genres": m.genres, "vote_average": m.vote_average,
                "popularity": m.popularity, "runtime": m.runtime,
                "release_date": m.release_date, "original_language": m.original_language,
            },
            "signal_type": rating_signal(r.value),
            "created_at": r.created_at,
        })

    drift = compute_drift_score(interactions)
    adaptations = get_drift_adaptations(drift)

    return {"drift": drift, "adaptations": adaptations}


@router.post("/extract-tone/{tmdb_id}")
async def extract_movie_tone(
    tmdb_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Extract LLM tone tags for a movie (Section 1.2)."""
    result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    movie = result.scalar_one_or_none()

    if not movie:
        return {"error": "Movie not found in catalog"}

    genres = [g.get("name", "") for g in (movie.genres or []) if isinstance(g, dict)]
    tags = await extract_tone_tags(movie.title, movie.overview or "", genres)

    return {"tmdb_id": tmdb_id, "title": movie.title, "tone_tags": tags}


@router.get("/bandit/weights")
async def bandit_weights(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get contextual bandit blend weights for this user."""
    rating_count = await db.scalar(
        select(Rating.id).where(Rating.user_id == user.id).limit(1).correlate(None)
    )
    # Simplified counts
    from sqlalchemy import func
    rc = await db.scalar(select(func.count()).select_from(Rating).where(Rating.user_id == user.id))
    from app.shared.models.social import Follow
    fc = await db.scalar(select(func.count()).select_from(Follow).where(Follow.follower_id == user.id))

    days = (
        __import__("datetime").datetime.now(__import__("datetime").timezone.utc) - user.created_at
    ).days

    segment = bandit.classify_user(rc or 0, fc or 0, days)
    weights = bandit.get_blend_weights(segment)
    stats = bandit.get_stats(segment)

    return {
        "segment": segment,
        "weights": weights,
        "arm_stats": stats,
    }


@router.get("/vector")
async def taste_vector(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the raw taste vector for this user."""
    ratings_result = await db.execute(
        select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id).where(Rating.user_id == user.id)
    )

    interactions = []
    for r, m in ratings_result.all():
        interactions.append({
            "movie_data": {
                "genres": m.genres, "vote_average": m.vote_average,
                "popularity": m.popularity, "runtime": m.runtime,
                "release_date": m.release_date, "original_language": m.original_language,
            },
            "signal_type": rating_signal(r.value),
            "created_at": r.created_at,
        })

    vec = compute_user_taste_vector(interactions)
    return {"vector": vec.tolist(), "dimensions": len(vec), "interaction_count": len(interactions)}
