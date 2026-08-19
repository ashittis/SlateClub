"""The two lenses.

Both read the **same evidence-backed pool** (KASET.md §9). Only the ranking
differs:

    COMMUNITY   "what are people recommending after this film?"
    FOR YOU     "what is most likely to work for this user?"

Keeping one pool is the point. If the lenses had separate candidate generation,
FOR YOU would drift into a personalisation engine and stop being evidence-first.
"""

from __future__ import annotations

from app.features.discovery.evidence.schema import Candidate
from app.features.discovery.scoring import ScoredCandidate, score_candidate


def taste_relevance(c: Candidate, taste: dict) -> float:
    """How well a candidate matches what this user already loves.

    Built only from things the user explicitly gave us or did — favourite
    people, languages, genres they rate well (KASET.md §9). No learned vector,
    no embedding: if we can't say why a film matched, we don't claim it did.
    """
    if not taste:
        return 0.0

    signals: list[float] = []

    langs = taste.get("languages") or []
    if langs and c.original_language:
        signals.append(1.0 if c.original_language in langs else 0.0)

    fav_genres = {g.lower() for g in (taste.get("genres") or [])}
    if fav_genres and c.genres:
        cand = {g.lower() for g in c.genres}
        signals.append(len(fav_genres & cand) / len(fav_genres | cand))

    return sum(signals) / len(signals) if signals else 0.0


def rank(
    candidates: list[Candidate],
    seed: dict,
    *,
    lens: str = "community",
    watched_tmdb_ids: set[int] | None = None,
    rated_tmdb_ids: set[int] | None = None,
    taste: dict | None = None,
) -> list[ScoredCandidate]:
    """Score and order the pool for one lens."""
    personalised = lens == "for_you"
    taste = taste or {}

    scored = [
        score_candidate(
            c,
            seed,
            # The community lens deliberately ignores who is asking — it answers
            # "what do people say", not "what suits you".
            watched_tmdb_ids=watched_tmdb_ids if personalised else None,
            rated_tmdb_ids=rated_tmdb_ids if personalised else None,
            taste_relevance=taste_relevance(c, taste) if personalised else 0.0,
        )
        for c in candidates
    ]
    scored.sort(key=lambda s: s.score, reverse=True)
    return scored
