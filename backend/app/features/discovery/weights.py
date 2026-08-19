"""Discovery scoring weights.

Deliberately **not hardcoded permanently** (KASET.md §9). These are the dials
that decide what surfaces, and the honest position is that we don't yet know
their right values — so they live in one place, are overridable from the
environment, and every score records the features that produced it so they can
be evaluated against real outcomes later.

Override with `KASET_DISCOVERY_W_<NAME>`, e.g.
`KASET_DISCOVERY_W_COMMUNITY_EVIDENCE=0.5`.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, fields

logger = logging.getLogger(__name__)

_ENV_PREFIX = "KASET_DISCOVERY_W_"


@dataclass(frozen=True, slots=True)
class Weights:
    # ── Positive signals ────────────────────────────────────────────────────
    #: How much people talk about it, damped so volume can't dominate.
    community_evidence: float = 0.35
    #: How many *different* sources agree — the strongest signal we have.
    cross_source_agreement: float = 0.25
    #: TMDB overlap with the seed: genre, language, era.
    contextual_similarity: float = 0.15
    #: FOR YOU lens only — overlap with what this user already loves.
    user_taste_relevance: float = 0.15
    #: Mild preference for the less obvious.
    novelty: float = 0.10

    # ── Penalties ───────────────────────────────────────────────────────────
    already_watched: float = 1.0
    already_rated: float = 0.35
    #: One source, one mention: interesting, but not yet evidence.
    weak_evidence: float = 0.30


def _from_env() -> Weights:
    overrides: dict[str, float] = {}
    for f in fields(Weights):
        raw = os.environ.get(f"{_ENV_PREFIX}{f.name.upper()}")
        if raw is None:
            continue
        try:
            overrides[f.name] = float(raw)
        except ValueError:
            logger.warning("Ignoring non-numeric %s%s=%r", _ENV_PREFIX, f.name.upper(), raw)
    if overrides:
        logger.info("discovery weights overridden: %s", overrides)
    return Weights(**overrides)


WEIGHTS = _from_env()
