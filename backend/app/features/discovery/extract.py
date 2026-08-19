"""Pulling film titles out of evidence.

The LLM's *only* job here is reading: given passages people wrote, which films
did they name, and in what terms? It is never asked to suggest anything
(KASET.md §9) — it cannot recommend a film that nobody mentioned, because it
never sees the question, only the answers.

Output is structured JSON, and it is treated as untrusted: every title is
resolved through TMDB downstream and dropped if it doesn't resolve.
"""

from __future__ import annotations

import logging

from app.features.discovery.evidence.schema import EvidenceItem
from app.integrations import llm

logger = logging.getLogger(__name__)

#: Batch size for evidence passages per LLM call. Large enough to see agreement
#: across a thread, small enough that one bad batch doesn't cost the whole pass.
BATCH_SIZE = 12

_SCHEMA = {
    "type": "object",
    "properties": {
        "films": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "year": {"type": ["string", "null"]},
                    "context": {
                        "type": "string",
                        "description": "The reason given for the recommendation, in the source's own terms",
                    },
                    "sentiment": {
                        "type": "string",
                        "enum": ["positive", "neutral", "negative"],
                    },
                },
                "required": ["title", "context", "sentiment"],
            },
        }
    },
    "required": ["films"],
}

_SYSTEM = (
    "You extract film titles from text that people wrote about films. "
    "You never suggest films yourself. If a passage names no films, return an "
    "empty list. Report only what the text actually says."
)


def _prompt(seed_title: str, passages: list[str]) -> str:
    joined = "\n\n---\n\n".join(passages)
    return (
        f"People were discussing what to watch after the film '{seed_title}'.\n\n"
        f"From the passages below, list every OTHER film that is mentioned as a "
        f"recommendation, comparison, or 'watch next' suggestion.\n\n"
        f"Rules:\n"
        f"- Do NOT include '{seed_title}' itself.\n"
        f"- Do NOT add films that are not named in the text.\n"
        f"- `context` must be the reason the text gives, in its own terms. If no "
        f"reason is given, say so plainly.\n"
        f"- `sentiment` is how the passage treats that film: recommended "
        f"(positive), merely mentioned (neutral), or warned against (negative).\n\n"
        f"PASSAGES:\n\n{joined}"
    )


async def extract_titles(
    seed_title: str, evidence: list[EvidenceItem]
) -> list[dict]:
    """Read evidence, return raw title mentions.

    Each mention carries the evidence it came from, so a candidate can be traced
    back to a source and a reason after resolution.

    Returns [] when no LLM is configured — the caller then has nothing to rank,
    which is the correct degraded behaviour rather than falling back to guessing.
    """
    if not llm.is_available() or not evidence:
        return []

    mentions: list[dict] = []
    for start in range(0, len(evidence), BATCH_SIZE):
        batch = evidence[start : start + BATCH_SIZE]
        result = await llm.generate_json(
            _prompt(seed_title, [e.truncated() for e in batch]),
            response_schema=_SCHEMA,
            system=_SYSTEM,
        )
        if not isinstance(result, dict):
            continue

        films = result.get("films")
        if not isinstance(films, list):
            logger.warning("discovery.extract: 'films' was %s, skipping batch", type(films))
            continue

        # The batch is one prompt over several passages, so a mention can't be
        # tied to a single item; attribute it to the batch's dominant source.
        source = batch[0].source
        source_name = batch[0].source_name
        source_url = batch[0].source_url
        authority = max(e.authority for e in batch)

        for f in films:
            if not isinstance(f, dict):
                continue
            title = (f.get("title") or "").strip()
            if not title or title.lower() == seed_title.lower():
                continue
            mentions.append(
                {
                    "title": title,
                    "year": (f.get("year") or None),
                    "context": (f.get("context") or "").strip()[:400],
                    "sentiment": f.get("sentiment") if f.get("sentiment") in
                    ("positive", "neutral", "negative") else "neutral",
                    "source": source,
                    "source_name": source_name,
                    "source_url": source_url,
                    "authority": authority,
                }
            )

    logger.info("discovery.extract %r → %d raw mentions", seed_title, len(mentions))
    return mentions
