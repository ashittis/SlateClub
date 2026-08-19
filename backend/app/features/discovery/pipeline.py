"""The discovery pipeline — seed film to five recommendations.

    SEED → INTENTS → EVIDENCE → EXTRACT → RESOLVE → POOL → SCORE → RANK → EVALUATE

Each stage is a separate module and testable on its own; this file is only the
orchestration and the persistence around it.

**Runs offline.** Collection hits Reddit and Brave and the LLM twice; the
request path reads the warm cache instead (KASET.md §9). `build_pool` is what
the warmer calls; `recommend` is what a route calls.
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.discovery import evaluate as evaluator
from app.features.discovery import extract, rank, resolve
from app.features.discovery.evidence import collect
from app.features.discovery.evidence.schema import Candidate
from app.shared.models.discovery_evidence import DiscoveryEvidence

logger = logging.getLogger(__name__)

#: The spec's target pool size — enough to rank meaningfully, capped so one
#: seed can't monopolise the warmer.
MIN_POOL = 20
MAX_POOL = 100


async def build_pool(
    db: AsyncSession,
    seed: dict,
    *,
    persist: bool = True,
) -> list[Candidate]:
    """Collect, extract, resolve — the expensive half. Offline only.

    `seed` needs at least tmdbId and title; year, genres and language sharpen
    both the search intents and the scoring.
    """
    title, year = seed["title"], seed.get("year")

    evidence = await collect.collect(title, year, seed.get("original_language"))
    if not evidence:
        logger.info("discovery: no evidence for %r — nothing to rank", title)
        return []

    mentions = await extract.extract_titles(title, evidence)
    candidates = await resolve.resolve(mentions, exclude_tmdb_id=seed.get("tmdbId"))

    if len(candidates) > MAX_POOL:
        # Trim by evidence volume before scoring, so the cap never silently
        # drops a well-supported film in favour of a one-off mention.
        candidates.sort(key=lambda c: (c.distinct_sources, c.mention_count), reverse=True)
        logger.info("discovery: pool of %d trimmed to %d", len(candidates), MAX_POOL)
        candidates = candidates[:MAX_POOL]

    if len(candidates) < MIN_POOL:
        logger.info(
            "discovery: thin pool for %r — %d candidates (target %d)",
            title, len(candidates), MIN_POOL,
        )

    if persist:
        await _persist_evidence(db, seed["tmdbId"], candidates)

    return candidates


async def _persist_evidence(
    db: AsyncSession, seed_tmdb_id: int, candidates: list[Candidate]
) -> None:
    """Replace this seed's evidence trail with the current pass."""
    await db.execute(
        delete(DiscoveryEvidence).where(DiscoveryEvidence.seed_tmdb_id == seed_tmdb_id)
    )
    for c in candidates:
        for m in c.mentions:
            db.add(
                DiscoveryEvidence(
                    seed_tmdb_id=seed_tmdb_id,
                    candidate_tmdb_id=c.tmdb_id,
                    candidate_title=c.title,
                    candidate_year=c.year,
                    candidate_poster_path=c.poster_path,
                    candidate_popularity=c.popularity,
                    candidate_language=c.original_language,
                    candidate_genres=c.genres or None,
                    source=m.get("source") or "unknown",
                    source_name=m.get("source_name"),
                    source_url=m.get("source_url"),
                    mention_context=m.get("context"),
                    mention_count=1,
                    authority_weight=float(m.get("authority") or 0.5),
                    sentiment=m.get("sentiment"),
                )
            )
    await db.flush()


async def candidates_from_evidence(
    db: AsyncSession, seed_tmdb_id: int
) -> list[Candidate]:
    """Rebuild the pool from persisted evidence — no network, no LLM.

    This is what makes the request path cheap: the expensive work happened in
    the warmer, and ranking a stored pool is pure computation.
    """
    rows = (
        await db.execute(
            select(DiscoveryEvidence).where(
                DiscoveryEvidence.seed_tmdb_id == seed_tmdb_id
            )
        )
    ).scalars().all()

    by_id: dict[int, Candidate] = {}
    for r in rows:
        c = by_id.get(r.candidate_tmdb_id)
        if c is None:
            c = Candidate(
                tmdb_id=r.candidate_tmdb_id,
                title=r.candidate_title or "",
                year=r.candidate_year,
                poster_path=r.candidate_poster_path,
                popularity=r.candidate_popularity,
                original_language=r.candidate_language,
                genres=list(r.candidate_genres or []),
            )
            by_id[r.candidate_tmdb_id] = c
        c.mentions.append(
            {
                "source": r.source,
                "source_name": r.source_name,
                "source_url": r.source_url,
                "context": r.mention_context,
                "authority": r.authority_weight,
                "sentiment": r.sentiment,
            }
        )
    return list(by_id.values())


async def recommend(
    db: AsyncSession,
    seed: dict,
    candidates: list[Candidate],
    *,
    lens: str = "community",
    watched_tmdb_ids: set[int] | None = None,
    rated_tmdb_ids: set[int] | None = None,
    taste: dict | None = None,
) -> list[dict]:
    """Score, rank and evaluate a pool into the final five."""
    if not candidates:
        return []

    scored = rank.rank(
        candidates,
        seed,
        lens=lens,
        watched_tmdb_ids=watched_tmdb_ids,
        rated_tmdb_ids=rated_tmdb_ids,
        taste=taste,
    )
    return await evaluator.evaluate(seed, scored, lens=lens, taste=taste)
