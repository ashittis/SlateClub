"""
Taste Vector Computation (Section 1.2 of ARCHITECTURE.md)

User taste vector = Σ (signal_weight × recency_decay × movie_embedding)

Movie embedding = genre one-hot (20-dim) + normalized metadata (5-dim) = 25-dim
(Simplified from 512-dim for Phase 3 — full embeddings come in Phase 5 with sentence-transformers + CLIP)
"""

import math
from datetime import datetime, timezone

import numpy as np

# 20 TMDB genre IDs → index mapping
GENRE_IDS = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37, 10769]
GENRE_INDEX = {gid: i for i, gid in enumerate(GENRE_IDS)}

VECTOR_DIM = 25  # 20 genre + 5 metadata
SIGNAL_WEIGHTS = {
    "rating_5": 1.0,
    "rating_4": 0.85,
    "rating_3": 0.6,
    "rating_2": 0.3,
    "rating_1": 0.1,
    "watched": 0.6,
    "watchlisted": 0.3,
    "favorite": 0.9,
    # Partial / abandoned watch signals derived from completion_pct.
    "watched_partial": 0.4,   # 70–89% completion
    "abandoned": -0.4,        # < 30% completion
    # Negative signals — push the taste vector AWAY from these movies.
    # Normalization uses |w| so negatives subtract without inverting scale.
    "not_for_me": -0.6,
    "skip": -0.3,
    "not_interested": -0.5,
}


def rating_signal(value: float) -> str:
    """Map a star rating (0.25-step, 0–5) to its taste-signal key.

    Ratings are stored at quarter-star precision, but the taste vector keys
    off whole-star buckets (``rating_1`` … ``rating_5``). Round half-up to the
    nearest whole star and clamp to [1, 5] — this keeps quarter/half stars
    meaningful (e.g. 4.75 → ``rating_5``, 4.25 → ``rating_4``) and avoids the
    old ``int(0.5) == 0 → rating_0`` truncation bug, which produced a key that
    isn't in ``SIGNAL_WEIGHTS``.
    """
    bucket = min(5, max(1, int(value + 0.5)))
    return f"rating_{bucket}"
DECAY_LAMBDA = 0.003  # half-life ~230 days; tuned for sparse-interaction users.
# Ramp toward 0.01 (half-life ~70d) once typical users have >50 interactions.

_SEED_PRIOR_ANCHOR_MIN = 0.30   # floor once user has ≥ 20 interactions
_SEED_PRIOR_ANCHOR_MAX = 0.85   # ceiling at 0 interactions (cold-start)
_SEED_PRIOR_RAMP_INTERACTIONS = 20  # linearly ramp from max → min over this many


def _seed_anchor_weight(n_interactions: int) -> float:
    """Return the onboarding anchor weight for this interaction count.

    Ramps from 0.85 (cold-start) down to 0.30 (established user) over the
    first 20 interactions. Below 20 the onboarding prior dominates; above 20
    revealed preferences take over but the prior never fully disappears.
    """
    t = min(n_interactions, _SEED_PRIOR_RAMP_INTERACTIONS) / _SEED_PRIOR_RAMP_INTERACTIONS
    return _SEED_PRIOR_ANCHOR_MAX - t * (_SEED_PRIOR_ANCHOR_MAX - _SEED_PRIOR_ANCHOR_MIN)


def movie_to_embedding(movie_data: dict) -> np.ndarray:
    """Convert movie metadata to a 25-dim embedding vector."""
    vec = np.zeros(VECTOR_DIM, dtype=np.float32)

    # Genre one-hot (dims 0-19)
    genres = movie_data.get("genres") or []
    if isinstance(genres, list):
        for g in genres:
            gid = g.get("id") if isinstance(g, dict) else g
            if gid in GENRE_INDEX:
                vec[GENRE_INDEX[gid]] = 1.0

    # Normalized metadata (dims 20-24)
    vec[20] = min((movie_data.get("vote_average") or 0) / 10.0, 1.0)
    vec[21] = min((movie_data.get("popularity") or 0) / 500.0, 1.0)
    runtime = movie_data.get("runtime") or 100
    vec[22] = min(runtime / 240.0, 1.0)  # normalized to 4h max

    # Release decade as signal
    release = movie_data.get("release_date") or ""
    if release and len(release) >= 4:
        try:
            year = int(release[:4])
            vec[23] = min(max((year - 1950) / 75.0, 0), 1.0)
        except ValueError:
            vec[23] = 0.5

    # Language signal (is it non-English?)
    lang = movie_data.get("original_language") or "en"
    vec[24] = 0.0 if lang == "en" else 1.0

    # Normalize
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec


def compute_user_taste_vector(
    interactions: list[dict],
    *,
    seed_prior: np.ndarray | None = None,
) -> np.ndarray:
    """
    Compute a user's taste vector from their interactions.

    Each interaction dict should have:
      - movie_data: dict with genres, vote_average, popularity, runtime, release_date, original_language
      - signal_type: str (e.g. "rating_5", "watched", "watchlisted", "favorite")
      - created_at: datetime

    If `seed_prior` is given (built from onboarding signals via
    `seed_prior_vector` below), it is blended in at a fixed anchor
    weight (`SEED_PRIOR_ANCHOR_WEIGHT`). The onboarding signal is
    treated as a stable prior rather than a decaying signal — so a
    user's declared taste continues to nudge recs even after many
    revealed-preference interactions. Revealed signals still
    dominate (1 - anchor_weight).
    """
    if not interactions:
        if seed_prior is not None and np.any(seed_prior):
            return _normalize(seed_prior.astype(np.float32))
        return np.zeros(VECTOR_DIM, dtype=np.float32)

    now = datetime.now(timezone.utc)
    weighted_sum = np.zeros(VECTOR_DIM, dtype=np.float32)
    total_weight = 0.0

    for interaction in interactions:
        signal_weight = SIGNAL_WEIGHTS.get(interaction["signal_type"], 0.0)
        if signal_weight == 0:
            continue
        movie_emb = movie_to_embedding(interaction["movie_data"])

        created = interaction.get("created_at")
        if created:
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            days_ago = (now - created).days
        else:
            days_ago = 0

        recency = math.exp(-DECAY_LAMBDA * days_ago)
        w = signal_weight * recency
        weighted_sum += w * movie_emb
        # Magnitude-based normalization so negative weights subtract
        # without flipping the scale.
        total_weight += abs(w)

    if total_weight > 0:
        weighted_sum /= total_weight

    # Blend in the onboarding prior with a weight that scales with how many
    # interactions the user has. Cold-start (0–5 interactions): prior
    # dominates at 0.85. Established user (≥20): prior settles to 0.30.
    # This closes the cliff-edge between n=0 (100% prior) and n=1 (30% prior).
    if seed_prior is not None and np.any(seed_prior):
        anchor = _seed_anchor_weight(len(interactions))
        weighted_sum = (
            (1 - anchor) * weighted_sum
            + anchor * seed_prior.astype(np.float32)
        )
        weighted_sum = _normalize(weighted_sum)

    return weighted_sum


def _normalize(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v)
    return v / n if n > 0 else v


# Indices into the 25-dim vector: 20 genre dims + 5 metadata.
# Metadata dims: 20=vote_avg, 21=popularity, 22=runtime, 23=decade, 24=non_english
LANG_DIM = 24
RUNTIME_DIM = 22
VOTE_DIM = 20

# Mood-axis to genre projections.
# - mood_realism positive  -> surreal/stylised (sci-fi, fantasy, animation)
# - mood_realism negative  -> grounded (drama, doc, history)
# - mood_tone negative     -> dark (horror, thriller, crime)
# - mood_tone positive     -> light (comedy, family, animation)
_REALISM_POS_GENRES = [878, 14, 16]   # Sci-Fi, Fantasy, Animation
_REALISM_NEG_GENRES = [18, 99, 36]    # Drama, Documentary, History
_TONE_NEG_GENRES = [27, 53, 80]       # Horror, Thriller, Crime
_TONE_POS_GENRES = [35, 10751, 16]    # Comedy, Family, Animation


def seed_prior_vector(
    *,
    poster_embeddings: list[np.ndarray] | None = None,
    origin_embedding: np.ndarray | None = None,
    favourite_embeddings: list[np.ndarray] | None = None,
    mood_pacing: float | None = None,
    mood_tone: float | None = None,
    mood_realism: float | None = None,
    language_codes: list[str] | None = None,
) -> np.ndarray:
    """
    Build a 25-dim seed taste vector from onboarding signals.
    Inputs are pre-computed embeddings (so the caller can do the
    DB lookups) plus the slider values and language codes.
    """
    vec = np.zeros(VECTOR_DIM, dtype=np.float32)
    n_components = 0

    pools: list[np.ndarray] = []
    if poster_embeddings:
        pools.extend(poster_embeddings)
    if origin_embedding is not None:
        # Vision says the origin film is a "north-star anchor" — weight 2x.
        pools.append(origin_embedding)
        pools.append(origin_embedding)
    if favourite_embeddings:
        pools.extend(favourite_embeddings)
    if pools:
        film_mean = np.mean(np.stack(pools), axis=0).astype(np.float32)
        vec += film_mean
        n_components += 1

    # Mood sliders → genre weights.
    if mood_realism is not None and abs(mood_realism) > 0.05:
        target = _REALISM_POS_GENRES if mood_realism > 0 else _REALISM_NEG_GENRES
        bump = abs(float(mood_realism)) * 0.4
        for gid in target:
            if gid in GENRE_INDEX:
                vec[GENRE_INDEX[gid]] += bump
        n_components += 1
    if mood_tone is not None and abs(mood_tone) > 0.05:
        target = _TONE_POS_GENRES if mood_tone > 0 else _TONE_NEG_GENRES
        bump = abs(float(mood_tone)) * 0.4
        for gid in target:
            if gid in GENRE_INDEX:
                vec[GENRE_INDEX[gid]] += bump
        n_components += 1

    # Pacing slider → runtime preference.
    # Negative = slow burn = long films; positive = high octane = short, kinetic.
    if mood_pacing is not None and abs(mood_pacing) > 0.05:
        vec[RUNTIME_DIM] = max(0.0, min(1.0, 0.5 - 0.4 * float(mood_pacing)))
        n_components += 1

    # Non-english language affinity hint.
    if language_codes:
        non_en = [c for c in language_codes if c and c != "en"]
        if non_en:
            vec[LANG_DIM] = 1.0

    if n_components == 0 and not language_codes:
        return vec  # zeros

    return _normalize(vec)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))
