"""Gathering evidence for a seed film.

Fans the search intents out across Reddit (primary) and Brave (secondary), and
normalises everything into `EvidenceItem`s.

**Offline only.** Both sources are rate-gated and this issues many requests per
seed, so it runs from the warmer, never the request path. A page that needs
discovery reads the warm cache (KASET.md §9).

Every source degrades independently: no Reddit key yields web-only evidence, no
Brave key yields Reddit-only, and neither yields an empty list rather than an
error. Discovery serving nothing is acceptable; discovery failing a page is not.
"""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import urlparse

from app.features.discovery import intents
from app.features.discovery.evidence.schema import EvidenceItem
from app.integrations import reddit, websearch

logger = logging.getLogger(__name__)

#: Sites whose recommendation lists are worth more than an anonymous blog.
_KNOWN_FILM_SITES = {
    "letterboxd.com", "rogerebert.com", "criterion.com", "bfi.org.uk",
    "sightandsound.com", "indiewire.com", "variety.com", "vulture.com",
    "theguardian.com", "nytimes.com", "avclub.com", "collider.com",
    "screenrant.com", "empireonline.com", "filmcomment.com", "mubi.com",
}


def _domain(url: str | None) -> str:
    if not url:
        return "unknown"
    try:
        return (urlparse(url).netloc or "unknown").removeprefix("www.")
    except ValueError:
        return "unknown"


def _web_authority(url: str | None) -> float:
    """Editorial film press outranks a random blog, which outranks unknown."""
    d = _domain(url)
    if d in _KNOWN_FILM_SITES:
        return 0.9
    if d.endswith((".edu", ".org")):
        return 0.6
    return 0.4


async def from_reddit(title: str, year: str | None, language: str | None) -> list[EvidenceItem]:
    """Reddit threads answering "what should I watch after X?".

    Reddit is the primary source because the answers come with reasons — which
    is what the extractor and the evaluator both need.
    """
    if not reddit.is_available():
        return []
    try:
        items = await reddit.recommendation_corpus(title, year, language)
    except Exception as exc:  # noqa: BLE001 - a source outage is not a failure
        logger.warning("discovery.reddit failed for %r: %s", title, exc)
        return []

    return [
        EvidenceItem(
            source="reddit",
            # The SUBREDDIT, not a constant "reddit". r/TrueFilm and r/horror
            # agreeing is real cross-source signal; collapsing them to one name
            # made agreement scoring a flat constant for every candidate.
            source_name=f"r/{i['subreddit']}",
            source_url=i.get("permalink"),
            text=i["text"],
            # Comment threads carry reasoning but no editorial standard.
            authority=0.7,
        )
        for i in items
        if i.get("text") and len(i["text"]) >= 40
    ]


async def from_web(title: str, year: str | None) -> list[EvidenceItem]:
    """Film sites, blogs and recommendation articles, via Brave."""
    if not websearch.is_available():
        return []

    queries = intents.web_queries(title, year)
    try:
        batches = await asyncio.gather(
            *(websearch.search(q, count=8) for q in queries), return_exceptions=True
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("discovery.web failed for %r: %s", title, exc)
        return []

    items: list[EvidenceItem] = []
    seen_urls: set[str] = set()
    for batch in batches:
        if isinstance(batch, BaseException):
            continue
        for r in batch:
            url = r.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            text = f"{r.get('title', '')}\n{r.get('snippet', '')}".strip()
            if len(text) < 40:
                continue
            items.append(
                EvidenceItem(
                    source="web",
                    source_name=_domain(url),
                    source_url=url,
                    text=text,
                    authority=_web_authority(url),
                )
            )
    return items


async def collect(
    title: str, year: str | None = None, language: str | None = None
) -> list[EvidenceItem]:
    """All evidence for a seed, from every configured source."""
    reddit_items, web_items = await asyncio.gather(
        from_reddit(title, year, language),
        from_web(title, year),
    )
    items = [*reddit_items, *web_items]
    logger.info(
        "discovery.evidence %r → %d items (%d reddit, %d web)",
        title, len(items), len(reddit_items), len(web_items),
    )
    return items
