"""
Match Cut — taste compatibility service.

The "cut between two matching shots", applied to taste: how well do two (or
more) people's cinematic taste vectors line up, and what should they watch
together? Built on the existing 25-dim taste vectors (Section 1.2) — no new
tables, everything derives from ratings / watch history.

Per-person fit is expressed as a cosine MATCH (0–1), deliberately not as a
predicted star rating: the ranker is not a calibrated rating regressor.
"""

from __future__ import annotations

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.embeddings.taste_vector import cosine_similarity, movie_to_embedding
from app.shared.models.actions import Rating, WatchHistory
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.taste_cache import _embedding_dict, get_user_taste_vector

HIGH_RATED = 4.0      # "loved it"
LOW_RATED = 2.5       # "not for me"
CANDIDATE_CAP = 500   # catalog is small; in-memory cosine is fine


async def _seen_movie_ids(db: AsyncSession, user_id: str) -> set[str]:
    """Movie ids the user has rated or watched (already-seen)."""
    out: set[str] = set()
    for model in (Rating, WatchHistory):
        rows = (
            await db.execute(select(model.movie_id).where(model.user_id == user_id))
        ).all()
        out.update(r[0] for r in rows)
    return out


def _film_item(m: Movie) -> dict:
    return {
        "tmdbId": m.tmdb_id,
        "title": m.title,
        "posterPath": m.poster_path,
        "releaseDate": m.release_date,
    }


# ── Pairwise taste match ─────────────────────────────────────────────


async def taste_match(me_id: str, target_id: str, db: AsyncSession) -> dict:
    """Vector compatibility + shared favourites and disagreements."""
    vec_me = await get_user_taste_vector(me_id, db)
    vec_target = await get_user_taste_vector(target_id, db)
    score = cosine_similarity(vec_me, vec_target)

    # Both users' rating maps (movie_id → value), joined with Movie once.
    def _rating_map(rows):
        return {r.movie_id: r.value for r, _ in rows}, {r.movie_id: m for r, m in rows}

    me_rows = (
        await db.execute(
            select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id).where(
                Rating.user_id == me_id
            )
        )
    ).all()
    target_rows = (
        await db.execute(
            select(Rating, Movie).join(Movie, Rating.movie_id == Movie.id).where(
                Rating.user_id == target_id
            )
        )
    ).all()
    me_vals, me_movies = _rating_map(me_rows)
    target_vals, target_movies = _rating_map(target_rows)
    common = set(me_vals) & set(target_vals)

    shared = sorted(
        (mid for mid in common
         if me_vals[mid] >= HIGH_RATED and target_vals[mid] >= HIGH_RATED),
        key=lambda mid: -(me_vals[mid] + target_vals[mid]),
    )[:6]
    disagree = [
        mid for mid in common
        if (me_vals[mid] >= HIGH_RATED and target_vals[mid] <= LOW_RATED)
        or (me_vals[mid] <= LOW_RATED and target_vals[mid] >= HIGH_RATED)
    ][:4]

    return {
        "score": round(float(score), 3),
        "sharedFavorites": [_film_item(me_movies[mid]) for mid in shared],
        "disagreements": [_film_item(me_movies[mid]) for mid in disagree],
        "targetRatedCount": len(target_vals),
    }


# ── Group consensus picks ────────────────────────────────────────────


async def match_cut_recommendations(
    member_ids: list[str], db: AsyncSession, limit: int = 18
) -> dict:
    """Consensus picks ranked by 0.6·min + 0.4·mean of per-member affinity."""
    member_ids = list(dict.fromkeys(member_ids))  # dedup, preserve order
    users = (
        await db.execute(select(User).where(User.id.in_(member_ids)))
    ).scalars().all()
    user_by_id = {u.id: u for u in users}

    # Taste vectors; keep only members with a usable (non-zero) vector.
    members: list[dict] = []
    for uid in member_ids:
        u = user_by_id.get(uid)
        if u is None:
            continue
        vec = await get_user_taste_vector(uid, db)
        members.append({
            "user": u,
            "vec": vec,
            "active": bool(np.any(vec)),
        })

    active = [m for m in members if m["active"]]

    # Candidate pool: popular films, excluding what the group has already seen.
    pool = (
        await db.execute(
            select(Movie)
            .where(Movie.poster_path.is_not(None))
            .order_by(Movie.popularity.desc().nullslast())
            .limit(CANDIDATE_CAP)
        )
    ).scalars().all()

    seen_sets = [await _seen_movie_ids(db, uid) for uid in member_ids]
    seen_union: set[str] = set().union(*seen_sets) if seen_sets else set()
    seen_all: set[str] = set.intersection(*seen_sets) if seen_sets else set()

    fresh = [m for m in pool if m.id not in seen_union]
    if len(fresh) < limit:
        # Relax: only drop films EVERY member has already seen.
        fresh = [m for m in pool if m.id not in seen_all]

    members_out = [
        {
            "userId": m["user"].id,
            "username": m["user"].username,
            "name": m["user"].name,
            "avatarUrl": m["user"].avatar_url,
        }
        for m in members
    ]

    scored: list[dict] = []
    for movie in fresh:
        emb = movie_to_embedding(_embedding_dict(movie))
        if active:
            per_member = [
                {
                    "userId": m["user"].id,
                    "username": m["user"].username,
                    "score": round(float(cosine_similarity(m["vec"], emb)), 3),
                }
                for m in active
            ]
            affinities = [p["score"] for p in per_member]
            group_score = 0.6 * min(affinities) + 0.4 * (sum(affinities) / len(affinities))
        else:
            # No usable taste vectors yet — fall back to popularity.
            per_member = []
            group_score = min(1.0, (movie.popularity or 0) / 500.0)

        scored.append({
            "tmdbId": movie.tmdb_id,
            "title": movie.title,
            "posterPath": movie.poster_path,
            "releaseDate": movie.release_date,
            "voteAverage": movie.vote_average,
            "groupScore": round(float(group_score), 3),
            "perMember": per_member,
        })

    scored.sort(key=lambda x: -x["groupScore"])
    return {"members": members_out, "items": scored[:limit]}
