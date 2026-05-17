"""
4-Stage Recommendation Pipeline (ARCHITECTURE.md Section 1.5)

Stage 1 — Candidate Generation  (~10,000 → 500)
Stage 2 — Pre-Filtering         (~500 → 300)
Stage 3 — Scoring & Ranking     (~300 → 30)
Stage 4 — Contextualization     (30 → final feed)
"""

import random
from datetime import datetime, timezone

import numpy as np

from ..embeddings.taste_vector import (
    compute_user_taste_vector,
    cosine_similarity,
    movie_to_embedding,
)
from typing import Any
from ..llm.gemini_client import deserialize_embedding
from ..models.als import ALSModel
from ..models.content_based import ContentBasedModel
from ..models.two_tower import TwoTowerModel
from ..models.xgboost_ranker import XGBoostRanker

# Mood → genre bias mapping for session mood
MOOD_GENRE_MAP = {
    "slow_contemplative": [18, 36, 99],       # Drama, History, Documentary
    "fast_intense": [28, 53, 80],             # Action, Thriller, Crime
    "funny_light": [35, 10751, 16],           # Comedy, Family, Animation
    "dark_unsettling": [27, 53, 9648],        # Horror, Thriller, Mystery
    "surprise": [],                            # maximize diversity
}

EXPLORE_RATIO = 0.3  # 30% explore, 70% exploit


def _language_interleave(
    candidates: list[dict],
    languages: list[str],
    n: int,
) -> list[dict]:
    """Round-robin pick across selected languages to enforce balance.

    For a user who selected [ml, fr, en] and n=10 the result is
    roughly 4-3-3, with the highest-scored film from each language
    appearing first in its slot. Score order within each language
    bucket is preserved. Languages outside the selection are used
    only to fill leftover slots after the round-robin exhausts.
    """
    if len(languages) <= 1:
        return candidates[:n]

    buckets: dict[str, list[dict]] = {lang: [] for lang in languages}
    other: list[dict] = []
    for c in candidates:
        lang = c.get("original_language") or "en"
        if lang in buckets:
            buckets[lang].append(c)
        else:
            other.append(c)

    result: list[dict] = []
    while len(result) < n:
        progressed = False
        for lang in languages:
            if buckets[lang]:
                result.append(buckets[lang].pop(0))
                progressed = True
                if len(result) >= n:
                    break
        if not progressed:
            break

    if len(result) < n:
        result.extend(other[: n - len(result)])

    return result


class RecommendationPipeline:
    """Full 4-stage recommendation pipeline."""

    def __init__(self):
        self.als = ALSModel(factors=64)
        self.content = ContentBasedModel()
        self.two_tower = TwoTowerModel(embed_dim=64)
        self.ranker = XGBoostRanker()

    def run(
        self,
        user_id: str,
        user_interactions: list[dict],
        all_movies: list[dict],
        watched_ids: set[str],
        dismissed_ids: set[str],
        session_mood: str | None = None,
        n_results: int = 30,
        user_priors: dict[str, Any] | None = None,
    ) -> list[dict]:
        """
        Run the full pipeline and return ranked recommendations.

        Args:
            user_id: Current user's ID
            user_interactions: List of {movie_data, signal_type, created_at}
            all_movies: List of all movie dicts in the catalog
            watched_ids: Set of movie IDs already watched
            dismissed_ids: Set of movie IDs user dismissed
            session_mood: Optional mood override
            n_results: Number of final results
            user_priors: Onboarding-derived priors. Keys:
                - seed_prior: np.ndarray (25-dim)
                - languages: list[str] (ISO-639-1)
                - mood_pacing/tone/realism: float in [-1, 1]
                - persistent_mood: str (slow_contemplative|...) — fallback
                  when session_mood is None
        """
        priors = user_priors or {}

        # ─── Stage 1: Candidate Generation ───────────────────
        candidates = self._stage1_candidate_gen(
            user_id, user_interactions, all_movies, priors
        )

        # ─── Stage 2: Pre-Filtering ─────────────────────────
        candidates = self._stage2_prefilter(
            candidates, watched_ids, dismissed_ids, priors
        )

        # ─── Stage 3: Scoring & Ranking ──────────────────────
        scored = self._stage3_rank(
            user_id, user_interactions, candidates, priors
        )

        # ─── Stage 4: Contextualization ──────────────────────
        # Persistent mood from onboarding kicks in only if user didn't
        # pick a session mood for this visit.
        effective_mood = session_mood or priors.get("persistent_mood")
        final = self._stage4_contextualize(
            scored, effective_mood, n_results, priors
        )

        return final

    def _stage1_candidate_gen(
        self,
        user_id: str,
        user_interactions: list[dict],
        all_movies: list[dict],
        priors: dict[str, Any] | None = None,
    ) -> list[dict]:
        """Generate ~500 candidates from multiple sources."""
        # Compute user taste vector — blend onboarding prior when sparse.
        seed = priors.get("seed_prior") if priors else None
        taste_vec = compute_user_taste_vector(user_interactions, seed_prior=seed)

        # Index all movies for content-based
        self.content.index_movies(all_movies)

        # Content-based candidates (top 200)
        content_scores = self.content.recommend(taste_vec, n=200)
        content_map = {mid: score for mid, score in content_scores}

        # ALS candidates (top 200) — if model is trained
        als_scores = self.als.recommend(user_id, n=200)
        als_map = {mid: score for mid, score in als_scores}

        # Two-tower is gated until trained (Phase 5). Skipping candidate
        # gen here keeps the random-projection noise out of the pool.
        # The module is preserved for the trained-model swap-in.
        tt_map: dict[str, float] = {}

        # Semantic candidates — cosine similarity between the user's
        # Gemini-embedded taste statement and each movie's
        # identity_embedding. Active only when both sides exist; until
        # the catalog is processed by extract_movie_identities the
        # `semantic_map` stays empty and we fall back to the existing
        # 25-dim path.
        semantic_map = self._semantic_candidates(
            priors, all_movies, top_k=300
        )

        # Trending boost (top 50 by popularity)
        trending = sorted(all_movies, key=lambda m: m.get("popularity") or 0, reverse=True)[:50]
        trending_ids = {m["id"] for m in trending}

        # Per-language top picks — guarantees that every user-selected
        # language has candidates in the pool so Stage 4 round-robin
        # has something to balance. Without this, an English-popular
        # catalog would starve Malayalam/French buckets even when the
        # user explicitly asked for them.
        per_lang_ids: set[str] = set()
        languages = (priors or {}).get("languages") or []
        if languages:
            for lang in languages:
                lang_movies = [
                    m for m in all_movies
                    if (m.get("original_language") or "en") == lang
                ]
                lang_movies.sort(
                    key=lambda m: m.get("popularity") or 0, reverse=True
                )
                for m in lang_movies[:50]:
                    per_lang_ids.add(m["id"])

        # Director affinity candidates — explicitly pull every film in the
        # catalog by a director the user named during onboarding. Without
        # this, director films only get a post-rank boost but may never
        # enter the candidate pool at all (content/ALS/trending might not
        # surface them, especially for arthouse / non-English directors).
        director_ids: set[str] = set()
        fav_directors = {
            d.lower()
            for d in ((priors or {}).get("favorite_directors") or [])
        }
        if fav_directors:
            for m in all_movies:
                credits = m.get("credits") or {}
                director_name = (
                    credits.get("director", {}).get("name")
                    if isinstance(credits, dict)
                    else None
                )
                if director_name and director_name.lower() in fav_directors:
                    director_ids.add(m["id"])

        # Merge all candidates
        all_candidate_ids = (
            set(content_map.keys())
            | set(als_map.keys())
            | set(semantic_map.keys())
            | trending_ids
            | per_lang_ids
            | director_ids
        )
        movie_lookup = {m["id"]: m for m in all_movies}

        candidates = []
        for mid in all_candidate_ids:
            movie = movie_lookup.get(mid)
            if not movie:
                continue
            candidates.append({
                **movie,
                "_content_score": content_map.get(mid, 0),
                "_als_score": als_map.get(mid, 0),
                "_tt_score": tt_map.get(mid, 0),
                "_semantic_score": semantic_map.get(mid, 0),
                "_is_trending": mid in trending_ids,
            })

        return candidates

    def _semantic_candidates(
        self,
        priors: dict[str, Any] | None,
        all_movies: list[dict],
        *,
        top_k: int,
    ) -> dict[str, float]:
        """Cosine similarity between the user's taste embedding and
        every movie's identity embedding. Returns the top_k as a
        {movie_id: score} map. Returns {} when either side is missing.
        """
        if not priors:
            return {}
        user_blob = priors.get("taste_embedding")
        user_emb = deserialize_embedding(user_blob) if user_blob else None
        if user_emb is None:
            return {}

        scored: list[tuple[str, float]] = []
        user_norm = float(np.linalg.norm(user_emb)) or 1.0
        for m in all_movies:
            movie_blob = m.get("identity_embedding")
            movie_emb = deserialize_embedding(movie_blob) if movie_blob else None
            if movie_emb is None:
                continue
            if movie_emb.shape != user_emb.shape:
                continue
            movie_norm = float(np.linalg.norm(movie_emb)) or 1.0
            score = float(np.dot(user_emb, movie_emb)) / (user_norm * movie_norm)
            scored.append((m["id"], score))

        scored.sort(key=lambda x: -x[1])
        return dict(scored[:top_k])

    def _stage2_prefilter(
        self,
        candidates: list[dict],
        watched_ids: set[str],
        dismissed_ids: set[str],
        priors: dict[str, Any] | None = None,
    ) -> list[dict]:
        """Remove watched/dismissed and (when set) language-mismatched."""
        languages = (priors or {}).get("languages") or []
        # Only apply the language filter when the user explicitly picked
        # something other than just English. Otherwise it would be too
        # restrictive on a Eurocentric default catalogue.
        non_default_lang_filter = bool(
            languages and not (len(languages) == 1 and languages[0] == "en")
        )
        lang_set = set(languages)

        filtered = []
        for c in candidates:
            mid = c["id"]
            if mid in watched_ids:
                continue
            if mid in dismissed_ids:
                continue
            if non_default_lang_filter:
                lang = c.get("original_language") or "en"
                if lang not in lang_set:
                    continue
            filtered.append(c)

        # If the language filter wiped out everything, fall back to
        # unfiltered (better to recommend something than nothing).
        if non_default_lang_filter and not filtered:
            for c in candidates:
                mid = c["id"]
                if mid in watched_ids or mid in dismissed_ids:
                    continue
                filtered.append(c)

        return filtered

    def _stage3_rank(
        self,
        user_id: str,
        user_interactions: list[dict],
        candidates: list[dict],
        priors: dict[str, Any] | None = None,
    ) -> list[dict]:
        """Score and rank candidates using XGBoost ranker."""
        if not candidates:
            return []

        seed = (priors or {}).get("seed_prior")
        taste_vec = compute_user_taste_vector(user_interactions, seed_prior=seed)

        languages = set((priors or {}).get("languages") or [])
        mood_pacing = (priors or {}).get("mood_pacing") or 0.0

        # Build feature matrix for ranker
        features = []
        for c in candidates:
            movie_emb = movie_to_embedding(c)
            taste_sim = cosine_similarity(taste_vec, movie_emb)

            # Genre overlap count
            user_genres = set()
            for inter in user_interactions:
                for g in (inter.get("movie_data", {}).get("genres") or []):
                    user_genres.add(g.get("id") if isinstance(g, dict) else g)
            movie_genres = set()
            for g in (c.get("genres") or []):
                movie_genres.add(g.get("id") if isinstance(g, dict) else g)
            genre_overlap = len(user_genres & movie_genres)

            # Recency (days since release)
            release = c.get("release_date") or ""
            recency = 0.5
            if release and len(release) >= 4:
                try:
                    year = int(release[:4])
                    recency = min(max((year - 2000) / 25.0, 0), 1.0)
                except ValueError:
                    pass

            # Language match with onboarding prefs.
            lang = c.get("original_language") or "en"
            language_match = 1.0 if lang in languages else 0.3

            # Mood alignment — pacing slider matched against runtime.
            # Negative pacing prefers long films; positive prefers short.
            runtime = c.get("runtime") or 110
            target_runtime = 130 - 30 * mood_pacing  # -1 -> 160m, +1 -> 100m
            mood_alignment = 1.0 - min(
                abs(runtime - target_runtime) / 90.0, 1.0
            )

            features.append([
                taste_sim,
                c.get("_als_score", 0),
                c.get("_content_score", 0),
                c.get("_tt_score", 0),
                1.0 if c.get("_is_trending") else 0.0,
                min((c.get("popularity") or 0) / 500.0, 1.0),
                recency,
                min(genre_overlap / 5.0, 1.0),
                language_match,
                mood_alignment,
                # Semantic similarity (Gemini-embedded taste statement
                # vs movie identity embedding). 0 when the user or the
                # movie hasn't been processed yet.
                max(0.0, float(c.get("_semantic_score", 0))),
            ])

        feature_matrix = np.array(features, dtype=np.float32)
        scores = self.ranker.rank(feature_matrix)

        # Attach scores to candidates
        for i, c in enumerate(candidates):
            c["_rank_score"] = float(scores[i])

        # Sort by rank score descending
        candidates.sort(key=lambda c: -c["_rank_score"])

        # Director affinity boost: 50% lift for movies by a director the user
        # explicitly named during onboarding. Applied before diversity penalty
        # so a single favourite-director film still surfaces near the top.
        fav_directors = {
            d.lower()
            for d in ((priors or {}).get("favorite_directors") or [])
        }
        if fav_directors:
            for c in candidates:
                credits = c.get("credits") or {}
                director = (
                    credits.get("director", {}).get("name")
                    if isinstance(credits, dict)
                    else None
                )
                if director and director.lower() in fav_directors:
                    c["_rank_score"] = c.get("_rank_score", 0) * 1.5

        # Diversity penalty: demote 3rd+ same-director film in top 10
        seen_directors = {}
        for i, c in enumerate(candidates[:10]):
            credits = c.get("credits") or {}
            director = credits.get("director", {}).get("name") if isinstance(credits, dict) else None
            if director:
                count = seen_directors.get(director, 0) + 1
                seen_directors[director] = count
                if count >= 3:
                    c["_rank_score"] *= 0.5

        # Re-sort after boost + penalty
        candidates.sort(key=lambda c: -c["_rank_score"])

        return candidates

    def _stage4_contextualize(
        self,
        candidates: list[dict],
        session_mood: str | None,
        n_results: int,
        priors: dict[str, Any] | None = None,
    ) -> list[dict]:
        """Apply session mood, explore/exploit split, and explanations."""
        if not candidates:
            return []

        # Time-of-day adjustment
        hour = datetime.now(timezone.utc).hour
        if 22 <= hour or hour < 6:  # late night
            for c in candidates:
                runtime = c.get("runtime") or 120
                genres = {g.get("id") if isinstance(g, dict) else g for g in (c.get("genres") or [])}
                if runtime <= 100 or 27 in genres or 53 in genres:
                    c["_rank_score"] = c.get("_rank_score", 0) * 1.15
        elif 6 <= hour < 12:  # morning
            for c in candidates:
                genres = {g.get("id") if isinstance(g, dict) else g for g in (c.get("genres") or [])}
                if 35 in genres or 10751 in genres:
                    c["_rank_score"] = c.get("_rank_score", 0) * 1.1

        # Session mood override
        if session_mood and session_mood != "skip":
            if session_mood == "surprise":
                random.shuffle(candidates)
            else:
                boost_genres = set(MOOD_GENRE_MAP.get(session_mood, []))
                if boost_genres:
                    for c in candidates:
                        genres = {g.get("id") if isinstance(g, dict) else g for g in (c.get("genres") or [])}
                        if genres & boost_genres:
                            c["_rank_score"] = c.get("_rank_score", 0) * 1.3

        # Re-sort
        candidates.sort(key=lambda c: -c.get("_rank_score", 0))

        # Explore/exploit split
        n_exploit = int(n_results * (1 - EXPLORE_RATIO))
        n_explore = n_results - n_exploit

        exploit_pool = candidates[:n_exploit]

        # Explore: pick from lower-ranked candidates with some randomness
        explore_pool = candidates[n_exploit:n_exploit + 100]
        if explore_pool:
            explore_picks = random.sample(explore_pool, min(n_explore, len(explore_pool)))
        else:
            explore_picks = []

        final = exploit_pool + explore_picks

        # Language balance — round-robin pick across all user-selected
        # languages so a user who picked ml/fr/en sees roughly equal
        # representation. Without this, English popularity dominates
        # even when the language filter passes all three. Score-order
        # within each language bucket is preserved.
        languages = (priors or {}).get("languages") or []
        if len(languages) > 1:
            final = _language_interleave(final, languages, n_results)

        # Generate explanations
        for c in final:
            c["_explanation"] = self._generate_explanation(c)

        # Assign surface slots
        for i, c in enumerate(final):
            if i < 3:
                c["_surface"] = "swipe_stack"
            elif i < 12:
                c["_surface"] = "for_you"
            elif i < 20:
                c["_surface"] = "taste_cluster"
            else:
                c["_surface"] = "might_surprise_you"

        return final

    def _generate_explanation(self, candidate: dict) -> str:
        """Generate a human-readable explanation for the recommendation."""
        score = candidate.get("_rank_score", 0)
        is_trending = candidate.get("_is_trending", False)
        content_score = candidate.get("_content_score", 0)
        als_score = candidate.get("_als_score", 0)

        if is_trending and score > 0.7:
            return "Trending now"
        if content_score > 0.8:
            return f"{int(content_score * 100)}% match for your taste"
        if als_score > 0.5:
            return "People with similar taste loved this"
        if candidate.get("vote_average", 0) > 8:
            return f"Highly rated · {candidate.get('vote_average', 0)}/10"
        return "Picked for you"
