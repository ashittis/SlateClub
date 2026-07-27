"""The single source of truth for the ranker's 12-feature row.

Extracted verbatim from RecommendationPipeline._stage3_rank so the live pipeline
and the offline harness build IDENTICAL features. The pipeline calls this per
candidate (with the Stage-1 pool scores attached); the harness calls it to
reconstruct features for a historical impression, rebuilding the taste vector
from only the interactions that preceded that impression.

Feature order is authoritative here AND must match XGBoostRanker.feature_names.
"""

from __future__ import annotations

from app.ml.embeddings.taste_vector import cosine_similarity, movie_to_embedding

# Matches XGBoostRanker.feature_names exactly.
FEATURE_NAMES = [
    "taste_similarity",
    "cf_score",
    "content_score",
    "two_tower_score",
    "trending_score",
    "popularity",
    "recency",
    "genre_overlap",
    "language_match",
    "mood_alignment",
    "semantic_similarity",
    "completion_pct_avg",
]


def _genre_ids(movie: dict) -> set:
    out: set = set()
    for g in (movie.get("genres") or []):
        out.add(g.get("id") if isinstance(g, dict) else g)
    return out


def user_genre_set(user_interactions: list[dict]) -> set:
    """The set of genre ids the user has interacted with (overlap feature)."""
    genres: set = set()
    for inter in user_interactions:
        genres |= _genre_ids(inter.get("movie_data", {}))
    return genres


def build_feature_row(
    candidate: dict,
    *,
    taste_vec,
    user_genres: set,
    languages: set,
    mood_pacing: float,
    genre_completion_map: dict,
) -> list[float]:
    """Build the ordered 12-feature row for one candidate.

    The Stage-1 pool scores (_als_score/_content_score/_tt_score/_semantic_score/
    _is_trending) are read from the candidate when present and default to 0 —
    so historical reconstruction (where they're absent) degrades gracefully to
    the taste/metadata features. See the harness report for that caveat."""
    movie_emb = movie_to_embedding(candidate)
    taste_sim = cosine_similarity(taste_vec, movie_emb)

    movie_genres = _genre_ids(candidate)
    genre_overlap = len(user_genres & movie_genres)

    release = candidate.get("release_date") or ""
    recency = 0.5
    if release and len(release) >= 4:
        try:
            year = int(release[:4])
            recency = min(max((year - 2000) / 25.0, 0), 1.0)
        except ValueError:
            pass

    lang = candidate.get("original_language") or "en"
    language_match = 1.0 if lang in languages else 0.3

    runtime = candidate.get("runtime") or 110
    target_runtime = 130 - 30 * mood_pacing  # -1 -> 160m, +1 -> 100m
    mood_alignment = 1.0 - min(abs(runtime - target_runtime) / 90.0, 1.0)

    genre_comps = [
        genre_completion_map[gid] for gid in movie_genres if gid in genre_completion_map
    ]
    completion_pct_avg = (
        sum(genre_comps) / len(genre_comps) / 100.0 if genre_comps else 0.5
    )

    return [
        taste_sim,
        candidate.get("_als_score", 0),
        candidate.get("_content_score", 0),
        candidate.get("_tt_score", 0),
        1.0 if candidate.get("_is_trending") else 0.0,
        min((candidate.get("popularity") or 0) / 500.0, 1.0),
        recency,
        min(genre_overlap / 5.0, 1.0),
        language_match,
        mood_alignment,
        max(0.0, float(candidate.get("_semantic_score", 0))),
        completion_pct_avg,
    ]
