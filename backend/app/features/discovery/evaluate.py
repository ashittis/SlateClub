"""The final evaluator — ranking, never inventing.

The LLM is given a seed, a resolved candidate pool, TMDB metadata, the evidence
behind each candidate, and (for FOR YOU) the user's taste signals. It picks the
best five and says why.

**It is constrained in code, not in the prompt.** Whatever it returns is
filtered against the pool's tmdb_id set, and anything not in the pool is
discarded. The guarantee that Kaset never recommends a hallucinated film does
not depend on the model complying with an instruction (KASET.md §9).
"""

from __future__ import annotations

import logging

from app.features.discovery.scoring import ScoredCandidate
from app.integrations import llm

logger = logging.getLogger(__name__)

FINAL_COUNT = 5
#: How many candidates the evaluator sees. Enough to choose from, few enough to
#: keep the whole pool and its evidence inside one prompt.
POOL_LIMIT = 30

_SCHEMA = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tmdb_id": {"type": "integer"},
                    "rank": {"type": "integer"},
                    "confidence": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["tmdb_id", "rank", "confidence", "reason"],
            },
        }
    },
    "required": ["recommendations"],
}

_SYSTEM = (
    "You rank films that other people have already recommended. You may only "
    "choose from the numbered candidate list you are given. You never introduce "
    "a film that is not in that list, and you never invent evidence."
)


def _describe(sc: ScoredCandidate, limit: int = 3) -> str:
    c = sc.candidate
    quotes = [
        f'  - [{m.get("source_name", "?")}] "{(m.get("context") or "").strip()}"'
        for m in c.mentions[:limit]
        if m.get("context")
    ]
    head = f"tmdb_id={c.tmdb_id} | {c.title} ({c.year or '?'}) | mentions={c.mention_count} across {c.distinct_sources} source(s)"
    return head + ("\n" + "\n".join(quotes) if quotes else "")


def _prompt(seed: dict, pool: list[ScoredCandidate], lens: str, taste: dict | None) -> str:
    listing = "\n".join(_describe(sc) for sc in pool)
    seed_line = f"{seed.get('title')} ({seed.get('year') or '?'})"
    genres = ", ".join(seed.get("genres") or []) or "unknown"

    if lens == "for_you":
        angle = (
            "Pick the five most likely to land for THIS viewer, using their "
            "taste signals below alongside the evidence."
        )
        taste_block = f"\n\nVIEWER'S TASTE:\n{taste}\n" if taste else "\n"
    else:
        angle = (
            "Pick the five the community most clearly stands behind. Weigh "
            "agreement across different sources above raw repetition."
        )
        taste_block = "\n"

    return (
        f"SEED FILM: {seed_line}\nGenres: {genres}\n{taste_block}"
        f"\nCANDIDATES (you may ONLY choose from these tmdb_ids):\n{listing}\n\n"
        f"{angle}\n\n"
        f"Return exactly {FINAL_COUNT} recommendations, ranked 1–{FINAL_COUNT}. "
        f"`reason` must explain the pick in terms of the evidence shown above and "
        f"how it relates to {seed_line} — one or two sentences, no marketing "
        f"language. `confidence` is 0–1."
    )


async def evaluate(
    seed: dict,
    scored: list[ScoredCandidate],
    *,
    lens: str = "community",
    taste: dict | None = None,
) -> list[dict]:
    """Return the final five, each traceable to the evidence behind it.

    Falls back to the top of the deterministic ranking when no LLM is available
    or its output can't be used — the pool is already ordered by a transparent
    score, so the feature degrades to "less well explained", not "broken".
    """
    if not scored:
        return []

    pool = scored[:POOL_LIMIT]
    allowed = {sc.candidate.tmdb_id: sc for sc in pool}

    picked: list[dict] = []
    if llm.is_available():
        result = await llm.generate_json(
            _prompt(seed, pool, lens, taste), response_schema=_SCHEMA, system=_SYSTEM
        )
        recs = (result or {}).get("recommendations")
        if isinstance(recs, list):
            seen: set[int] = set()
            for r in recs:
                if not isinstance(r, dict):
                    continue
                tmdb_id = r.get("tmdb_id")
                # THE constraint. Anything outside the pool is discarded here,
                # regardless of what the model claimed.
                if tmdb_id not in allowed or tmdb_id in seen:
                    if tmdb_id is not None and tmdb_id not in allowed:
                        logger.warning(
                            "discovery.evaluate: model returned tmdb_id=%s outside the pool; discarded",
                            tmdb_id,
                        )
                    continue
                seen.add(tmdb_id)
                picked.append(
                    {
                        "sc": allowed[tmdb_id],
                        "confidence": float(r.get("confidence") or 0.5),
                        "reason": (r.get("reason") or "").strip(),
                    }
                )

    # Top up from the deterministic ranking if the model returned too few.
    if len(picked) < FINAL_COUNT:
        chosen = {p["sc"].candidate.tmdb_id for p in picked}
        for sc in pool:
            if len(picked) >= FINAL_COUNT:
                break
            if sc.candidate.tmdb_id in chosen:
                continue
            picked.append({"sc": sc, "confidence": 0.4, "reason": ""})

    out = []
    for i, p in enumerate(picked[:FINAL_COUNT], start=1):
        sc: ScoredCandidate = p["sc"]
        c = sc.candidate
        out.append(
            {
                "tmdbId": c.tmdb_id,
                "rank": i,
                "confidence": round(min(max(p["confidence"], 0.0), 1.0), 2),
                "reason": p["reason"],
                "title": c.title,
                "year": c.year,
                "posterPath": c.poster_path,
                "score": sc.score,
                "features": sc.features,
                "evidence": [
                    {
                        "source": m.get("source"),
                        "sourceName": m.get("source_name"),
                        "sourceUrl": m.get("source_url"),
                        "context": m.get("context"),
                        "sentiment": m.get("sentiment"),
                    }
                    for m in c.mentions[:5]
                ],
            }
        )
    return out
