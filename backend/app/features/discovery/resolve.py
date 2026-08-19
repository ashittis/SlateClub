"""Turning extracted titles into real films.

**The rule: never recommend an unresolved title** (KASET.md §9). A title the
LLM read out of a comment is a string; a recommendation Kaset can show is a
TMDB film with a poster and a page. Anything that fails to resolve is dropped,
not guessed at.

Resolution also merges: the same film named in twelve places becomes one
candidate with twelve mentions, which is what makes cross-source agreement
measurable.
"""

from __future__ import annotations

import asyncio
import logging
import re

from app.features.discovery.evidence.schema import Candidate
from app.integrations import tmdb

logger = logging.getLogger(__name__)

#: Cap the resolution fan-out — a noisy extraction pass can name hundreds of
#: strings, and each costs a TMDB round-trip.
MAX_LOOKUPS = 120

_ARTICLES = re.compile(r"^(the|a|an)\s+", re.IGNORECASE)
_PUNCT = re.compile(r"[^\w\s]")


def normalise(title: str) -> str:
    """A comparison key that survives punctuation and leading articles."""
    t = _PUNCT.sub(" ", title.lower())
    t = _ARTICLES.sub("", t.strip())
    return " ".join(t.split())


def _year_of(raw: dict) -> str | None:
    return (raw.get("release_date") or "")[:4] or None


def _pick(results: list[dict], title: str, year: str | None) -> dict | None:
    """Choose the TMDB result that best matches an extracted title.

    Exact normalised title wins; a matching year breaks ties. Popularity is the
    last resort — it's the reason "Parasite" resolves to the 2019 film rather
    than an obscure namesake, but it must never override an exact year match.
    """
    if not results:
        return None
    key = normalise(title)

    exact = [r for r in results if normalise(r.get("title") or "") == key]
    pool = exact or results

    if year:
        dated = [r for r in pool if _year_of(r) == year]
        if dated:
            pool = dated

    return max(pool, key=lambda r: r.get("popularity") or 0.0)


async def _lookup(title: str, year: str | None) -> dict | None:
    try:
        data = await tmdb.search_movies(title)
    except Exception as exc:  # noqa: BLE001
        logger.debug("discovery.resolve miss for %r: %s", title, exc)
        return None
    return _pick(data.get("results") or [], title, year)


async def resolve(mentions: list[dict], *, exclude_tmdb_id: int | None = None) -> list[Candidate]:
    """Resolve raw mentions into merged, TMDB-backed candidates."""
    if not mentions:
        return []

    # Group by normalised title first so one film costs one lookup.
    grouped: dict[str, list[dict]] = {}
    for m in mentions:
        grouped.setdefault(normalise(m["title"]), []).append(m)

    keys = list(grouped)[:MAX_LOOKUPS]
    if len(grouped) > MAX_LOOKUPS:
        logger.info(
            "discovery.resolve: %d distinct titles, looking up first %d",
            len(grouped), MAX_LOOKUPS,
        )

    lookups = await asyncio.gather(
        *(
            _lookup(grouped[k][0]["title"], grouped[k][0].get("year"))
            for k in keys
        ),
        return_exceptions=True,
    )

    by_tmdb: dict[int, Candidate] = {}
    dropped = 0
    for key, raw in zip(keys, lookups):
        if isinstance(raw, BaseException) or not raw or not raw.get("id"):
            dropped += 1
            continue
        tmdb_id = raw["id"]
        if exclude_tmdb_id is not None and tmdb_id == exclude_tmdb_id:
            continue

        cand = by_tmdb.get(tmdb_id)
        if cand is None:
            cand = Candidate(
                tmdb_id=tmdb_id,
                title=raw.get("title") or grouped[key][0]["title"],
                year=_year_of(raw),
                poster_path=raw.get("poster_path"),
                popularity=raw.get("popularity"),
                original_language=raw.get("original_language"),
            )
            by_tmdb[tmdb_id] = cand
        # Two spellings of the same film merge here, which is exactly what
        # makes the mention count meaningful.
        cand.mentions.extend(grouped[key])

    logger.info(
        "discovery.resolve → %d candidates (%d titles dropped as unresolvable)",
        len(by_tmdb), dropped,
    )
    return list(by_tmdb.values())
