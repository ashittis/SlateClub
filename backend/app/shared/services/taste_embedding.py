"""Taste embedding refresh service.

Generates and stores a user's OpenAI taste statement + embedding.
Triggered after the 5th rating and after drift events.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.actions import Rating, Review
from app.shared.models.movie import Movie
from app.shared.models.onboarding import FavoritePerson
from app.shared.models.user import UserTasteState
from app.ml.llm import openai_client as llm
from app.ml.llm.taste_describer import embed_taste_statement, generate_taste_description


async def refresh_taste_embedding(user_id: str, db: AsyncSession) -> bool:
    """Generate and upsert the user's taste statement + embedding.

    Returns True if the embedding was written, False if skipped or failed.
    Silently swallows all exceptions so callers never break on this.
    """
    try:
        if not llm.is_available():
            return False

        top_rated = (
            await db.execute(
                select(Rating, Movie)
                .join(Movie, Rating.movie_id == Movie.id)
                .where(Rating.user_id == user_id, Rating.value >= 4)
                .order_by(Rating.value.desc())
                .limit(15)
            )
        ).all()
        top_movie_titles = [m.title for _, m in top_rated if m.title]

        genre_counts: dict[str, int] = {}
        for _, m in top_rated:
            for g in m.genres or []:
                name = g.get("name") if isinstance(g, dict) else None
                if name:
                    genre_counts[name] = genre_counts.get(name, 0) + 1
        fav_genres = sorted(genre_counts, key=lambda k: -genre_counts[k])[:5]

        fav_directors = [
            r[0]
            for r in (
                await db.execute(
                    select(FavoritePerson.name).where(FavoritePerson.user_id == user_id)
                )
            ).all()
            if r[0]
        ]

        reviews = (
            await db.execute(
                select(Review, Movie)
                .join(Movie, Review.movie_id == Movie.id)
                .where(Review.user_id == user_id)
                .order_by(Review.created_at.desc())
                .limit(20)
            )
        ).all()
        review_dicts = [{"movie_title": m.title, "body": r.body} for r, m in reviews]

        description = await generate_taste_description(
            reviews=review_dicts,
            top_rated_movies=top_movie_titles,
            favorite_genres=fav_genres,
            favorite_directors=fav_directors,
        )

        if not description or "Not enough data" in description:
            return False

        vec = await embed_taste_statement(description)
        if vec is None:
            return False

        embedding_bytes = llm.serialize_embedding(vec)

        state = (
            await db.execute(
                select(UserTasteState).where(UserTasteState.user_id == user_id)
            )
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if state is None:
            state = UserTasteState(
                user_id=user_id,
                taste_statement=description,
                taste_embedding=embedding_bytes,
                last_computed_at=now,
            )
            db.add(state)
        else:
            state.taste_statement = description
            state.taste_embedding = embedding_bytes
            state.last_computed_at = now

        await db.flush()
        return True

    except Exception as exc:
        print(f"[taste-embedding] refresh failed for user {user_id}: {exc}")
        return False
