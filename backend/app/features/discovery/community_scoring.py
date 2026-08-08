"""Community consensus scoring — pure, no I/O, unit-testable.

The heart of the Community Intelligence Engine's "grounding": turns a flat list
of resolved film mentions (each tagged with the source it came from) into a
ranked consensus, where the score is derived from REAL weighted mention
frequency + cross-source agreement — not an LLM-invented number.
"""

from __future__ import annotations

# Source authority — how much a single mention counts toward consensus.
# Reddit threads are raw community consensus (highest signal); editorial blogs
# carry curation weight; YouTube titles and loose web results are noisier.
SOURCE_WEIGHTS: dict[str, float] = {
    "reddit": 1.0,
    "blog": 0.85,
    "youtube": 0.6,
    "web": 0.5,
}

# Domains we treat as editorial film press → "blog". Everything else that isn't
# Reddit/YouTube falls back to the lower-weight generic "web".
_BLOG_DOMAINS = (
    "collider", "screenrant", "indiewire", "bfi.org", "tasteofcinema",
    "vulture", "slashfilm", "empireonline", "rogerebert", "denofgeek",
    "thrillist", "hollywoodreporter", "variety", "polygon", "gq.com",
    "esquire", "rollingstone", "avclub", "littlewhitelies",
)


def classify_source(url: str) -> str:
    """Map a result URL to a source type used for authority weighting."""
    u = (url or "").lower()
    if "reddit.com" in u:
        return "reddit"
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if any(d in u for d in _BLOG_DOMAINS):
        return "blog"
    return "web"


def source_weight(source: str) -> float:
    return SOURCE_WEIGHTS.get(source, SOURCE_WEIGHTS["web"])


def aggregate_mentions(mentions: list[dict]) -> list[dict]:
    """Group resolved mentions by tmdbId into consensus records, ranked
    strongest-consensus first.

    Each input mention is a dict with at least `tmdbId` and `source`; `stub`
    (the resolved TMDB movie stub) is carried through when present. Pure.

    rawScore rewards cross-source agreement: a film cited on Reddit AND a blog
    is stronger consensus than three mentions in one place.
    """
    groups: dict[int, dict] = {}
    for m in mentions:
        tid = m.get("tmdbId")
        if not tid:
            continue
        g = groups.get(tid)
        if g is None:
            g = {
                "tmdbId": tid,
                "mentionCount": 0,
                "weighted": 0.0,
                "sources": {},
                "stub": m.get("stub"),
            }
            groups[tid] = g
        src = m.get("source", "web")
        g["mentionCount"] += 1
        g["weighted"] += source_weight(src)
        g["sources"][src] = g["sources"].get(src, 0) + 1
        if g.get("stub") is None and m.get("stub"):
            g["stub"] = m["stub"]

    records = list(groups.values())
    for g in records:
        diversity = len(g["sources"])
        g["rawScore"] = g["weighted"] * (1.0 + 0.15 * (diversity - 1))
    records.sort(key=lambda g: (-g["rawScore"], -g["mentionCount"], g["tmdbId"]))
    return records


def match_score(raw: float, top_raw: float) -> int:
    """Map a raw consensus score to a 0–100 % relative to the strongest
    consensus in the pool. Top film lands ~97; tapers down toward ~58. The
    number is grounded in real mention weight, not LLM invention."""
    if top_raw <= 0:
        return 60
    r = max(0.0, min(1.0, raw / top_raw))
    return int(round(58 + 39 * r))


def source_label(sources: dict[str, int]) -> str:
    """Human provenance line for a consensus record, e.g.
    'Mentioned across Reddit + 2 film blogs'."""
    parts: list[str] = []
    if sources.get("reddit"):
        parts.append("Reddit")
    blogs = sources.get("blog", 0)
    if blogs:
        parts.append("a film blog" if blogs == 1 else f"{blogs} film blogs")
    if sources.get("youtube"):
        parts.append("YouTube")
    web = sources.get("web", 0)
    if web:
        parts.append("an article" if web == 1 else f"{web} articles")
    if not parts:
        return ""
    if len(parts) == 1:
        return f"Mentioned on {parts[0]}"
    return "Mentioned across " + " + ".join(parts)
