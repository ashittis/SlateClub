"""Scoring candidates — transparent, and recorded.

Pure functions, no I/O. Every score comes with the features that produced it,
so a recommendation can be explained after the fact and the weights can be
tuned against real outcomes rather than intuition (KASET.md §9).

    score =  community evidence        (mentions × authority, log-damped)
           + cross-source agreement    (distinct sources and source types)
           + contextual similarity     (genre / language / era overlap)
           + user taste relevance      (FOR YOU only)
           + novelty
           − already watched
           − already rated
           − weak evidence
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.features.discovery.evidence.schema import Candidate
from app.features.discovery.weights import WEIGHTS, Weights

#: Sentiment multiplies a mention's worth — a film someone warns you off is
#: evidence *against*, not just weaker evidence for.
SENTIMENT_FACTOR = {"positive": 1.0, "neutral": 0.6, "negative": -0.5}


@dataclass(slots=True)
class ScoredCandidate:
    candidate: Candidate
    score: float
    #: Every intermediate value, persisted so weights can be evaluated later.
    features: dict = field(default_factory=dict)


def _community_evidence(c: Candidate) -> float:
    """Mentions weighted by authority and sentiment, log-damped.

    Damping matters: without it, one very chatty thread outweighs three
    independent sources, which is the opposite of what we want.
    """
    raw = sum(
        float(m.get("authority") or 0.5)
        * SENTIMENT_FACTOR.get(m.get("sentiment", "neutral"), 0.6)
        for m in c.mentions
    )
    if raw <= 0:
        return max(raw, -1.0)
    return min(math.log1p(raw) / math.log1p(12.0), 1.0)


def _cross_source_agreement(c: Candidate) -> float:
    """Distinct voices, not distinct sentences.

    Two source *types* (Reddit and the press) agreeing counts for more than
    five posts in one subreddit.
    """
    names = min(c.distinct_sources, 6) / 6.0
    types = (len(c.source_types) - 1) / 1.0 if c.source_types else 0.0
    return min(0.7 * names + 0.3 * max(types, 0.0), 1.0)


def _contextual_similarity(c: Candidate, seed: dict) -> float:
    """Genre, language and era overlap with the seed film."""
    score, parts = 0.0, 0

    seed_genres = {g.lower() for g in (seed.get("genres") or [])}
    if seed_genres and c.genres:
        cand_genres = {g.lower() for g in c.genres}
        score += len(seed_genres & cand_genres) / len(seed_genres | cand_genres)
        parts += 1

    if seed.get("original_language") and c.original_language:
        score += 1.0 if seed["original_language"] == c.original_language else 0.0
        parts += 1

    seed_year, cand_year = seed.get("year"), c.year
    if seed_year and cand_year and seed_year.isdigit() and cand_year.isdigit():
        gap = abs(int(seed_year) - int(cand_year))
        score += max(0.0, 1.0 - gap / 40.0)
        parts += 1

    return score / parts if parts else 0.0


def _novelty(c: Candidate) -> float:
    """Mild preference for the less obvious.

    Popularity is inverted rather than ignored: a blockbuster everyone has seen
    is a weaker recommendation than an equally well-evidenced film they haven't.
    """
    pop = c.popularity or 0.0
    return 1.0 - min(pop / 200.0, 1.0)


def _weak_evidence(c: Candidate) -> float:
    """1.0 when a candidate rests on a single mention from a single source."""
    if c.mention_count <= 1 and c.distinct_sources <= 1:
        return 1.0
    if c.mention_count <= 2 and c.distinct_sources <= 1:
        return 0.5
    return 0.0


def score_candidate(
    c: Candidate,
    seed: dict,
    *,
    watched_tmdb_ids: set[int] | None = None,
    rated_tmdb_ids: set[int] | None = None,
    taste_relevance: float = 0.0,
    weights: Weights = WEIGHTS,
) -> ScoredCandidate:
    watched = bool(watched_tmdb_ids and c.tmdb_id in watched_tmdb_ids)
    rated = bool(rated_tmdb_ids and c.tmdb_id in rated_tmdb_ids)

    features = {
        "community_evidence": _community_evidence(c),
        "cross_source_agreement": _cross_source_agreement(c),
        "contextual_similarity": _contextual_similarity(c, seed),
        "user_taste_relevance": taste_relevance,
        "novelty": _novelty(c),
        "already_watched": 1.0 if watched else 0.0,
        "already_rated": 1.0 if rated else 0.0,
        "weak_evidence": _weak_evidence(c),
        # Raw counts kept alongside the normalised features for later analysis.
        "mention_count": c.mention_count,
        "distinct_sources": c.distinct_sources,
    }

    score = (
        weights.community_evidence * features["community_evidence"]
        + weights.cross_source_agreement * features["cross_source_agreement"]
        + weights.contextual_similarity * features["contextual_similarity"]
        + weights.user_taste_relevance * features["user_taste_relevance"]
        + weights.novelty * features["novelty"]
        - weights.already_watched * features["already_watched"]
        - weights.already_rated * features["already_rated"]
        - weights.weak_evidence * features["weak_evidence"]
    )
    return ScoredCandidate(candidate=c, score=round(score, 4), features=features)
