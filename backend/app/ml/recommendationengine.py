"""
SlateClub Recommendation Engine — current implementation status
===============================================================

IMPLEMENTED (as of migration 0017)
───────────────────────────────────
Layer 0 – Cold-start / onboarding priors
  ✓ seed_prior_vector       25-dim taste vector from poster picks, origin film,
                             favourites, mood sliders, language codes
  ✓ onboarding blending     anchor weight ramps 0.85→0.30 over first 20
                             interactions (taste_vector.py)

Layer 1 – Candidate generation  (~10 000 → 500)
  ✓ Content-based           genre-vector cosine similarity (top 200)
  ✓ ALS collaborative       implicit-feedback matrix factorisation, 64 factors
                             (untrained until data is available; returns [] gracefully)
  ✓ Semantic candidates     Gemini taste-embedding ↔ movie identity-embedding
                             cosine similarity (top 300, gates on embeddings present)
  ✓ Trending                top 50 by TMDB popularity
  ✓ Per-language pool       top 50 popular per user-selected language so
                             non-English buckets are always represented
  ✓ Director affinity pool  every catalog film by a user-named director
  ✗ Two-tower               module exists (two_tower.py) but weights are a
                             random projection; gated to 0.00 weight until
                             Phase 5 PyTorch training

Layer 2 – Pre-filtering  (~500 → 300)
  ✓ Watched filter          exclude movies in WatchHistory
  ✓ Dismissed filter        exclude MicroFeedback "not_for_me"
  ✓ Language filter         only when user explicitly picked non-English;
                             falls back to unfiltered if it wipes the pool

Layer 3 – Scoring & ranking  (~300 → 30)
  ✓ XGBoost ranker          11-feature weighted sum fallback until trained;
                             features: taste_sim, ALS, content, two_tower (0),
                             trending, popularity, recency, genre_overlap,
                             language_match, mood_alignment, semantic_sim
  ✓ Director affinity boost 1.5× lift for films by a user-named director
  ✓ Diversity penalty       3rd+ film from same director in top-10 → 0.5×

Layer 4 – Contextualisation  (30 → final feed)
  ✓ Time-of-day adjustment  late-night boosts short / horror / thriller;
                             morning boosts comedy / family
  ✓ Session mood override   genre-boost from MOOD_GENRE_MAP; "surprise" shuffles
  ✓ Persistent mood         falls back to onboarding pacing/tone slider reading
  ✓ Explore/exploit split   30 % explore from positions 21–120 (random sample)
  ✓ Language round-robin    even distribution across user-selected languages
  ✓ Surface assignment      swipe_stack / for_you / taste_cluster /
                             might_surprise_you
  ✓ Explanation generation  human-readable reason string per result

LLM layer (Gemini)
  ✓ gemini_client           generate_json / embed / serialize / deserialize
  ✓ movie_identity          Gemini-extracted MovieIdentity JSON + embedding
                             (offline script: scripts/extract_movie_identities.py)
  ✓ taste_describer         LLM-generated taste statement + tone-tag extraction
  ✓ taste_identity          Primary axes, genre blend, director affinities,
                             taste statement, tribe memberships
  ✓ drift_detector          cosine drift between last-30d and lifetime vectors;
                             threshold 0.35 → phase transition
  ✓ contextual_bandit       user segment classification + blend-weight grid

Graph layer (Neo4j)
  ✓ taste_graph             User / Movie / Director / Theme / Cluster nodes +
                             WATCHED / RATED / REVIEWED / TASTE_SIMILAR / AFFINITY /
                             SIMILAR_TONE / MEMBER_OF edges
  ✓ community               Louvain cluster detection
  ✓ graph_recommend         cluster-popular, friend-boost, director-affinity queries

DB state (migrations applied)
  ✓ 0001–0015               core tables, slates, discourse, notifications, etc.
  ✓ 0016  movie_identity     movies.identityJson / identityEmbedding /
                             identityUpdatedAt columns + pending index
  ✓ 0017  user_taste_state   user_taste_state (taste_statement, taste_embedding,
                             tone_axes, last_drift_score, last_computed_at)

API routes
  ✓ GET  /api/recommendations/for-you        4-stage pipeline, paginated
  ✓ GET  /api/recommendations/session-moods  mood picker options
  ✓ GET  /api/recommendations/debug          diagnostic dump (priors, catalogue)
  ✓ GET  /api/taste/identity                 taste identity profile
  ✓ GET  /api/taste/drift                    drift score + adaptations
  ✓ POST /api/taste/extract-tone/{tmdb_id}   LLM tone extraction for one film
  ✓ GET  /api/taste/bandit/weights           contextual bandit blend weights
  ✓ GET  /api/taste/vector                   raw 25-dim taste vector

PENDING / NOT YET DONE
───────────────────────
  □ Two-tower training      PyTorch model on historical (user, movie, label) tuples
  □ XGBoost training        need accumulated impression + engagement data
  □ ALS training            need sufficient interaction volume (~50 users × 10 films)
  □ movie_identity bulk run scripts/extract_movie_identities.py on full catalog
  □ user_taste_state writer periodic job to (re-)compute taste_embedding per user
  □ Reddit / Letterboxd     _external_sources_for() stub in movie_identity.py
  □ Graph hydration         upsert_movie_node / set_user_* called on every
                             rating/review/watch event (hook into routes)
"""

from .pipeline.recommendation_pipeline import RecommendationPipeline
from .llm.taste_identity import compute_taste_identity
from .llm.drift_detector import compute_drift_score, get_drift_adaptations
from .llm.contextual_bandit import bandit
from .llm.movie_identity import extract_and_embed
from .graph.taste_graph import (
    get_user_clusters,
    get_friend_boost_movies,
    get_director_affinity_movies,
)
from .embeddings.taste_vector import (
    compute_user_taste_vector,
    seed_prior_vector,
    cosine_similarity,
)

__all__ = [
    "RecommendationPipeline",
    "compute_taste_identity",
    "compute_drift_score",
    "get_drift_adaptations",
    "bandit",
    "extract_and_embed",
    "get_user_clusters",
    "get_friend_boost_movies",
    "get_director_affinity_movies",
    "compute_user_taste_vector",
    "seed_prior_vector",
    "cosine_similarity",
]
