"""What a piece of evidence is.

Every candidate film Kaset recommends must be traceable to something a real
person wrote. `EvidenceItem` is that trace: where it came from, what it said,
and how much the source is worth (KASET.md §9).

Retained per the spec: source, source URL, subreddit/site, mention context,
mention count, evidence text, source authority, and sentiment where available.
Raw mention counts are never the whole story — authority and cross-source
agreement matter more than volume, which is why they live on the record rather
than being recomputed from a tally.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class EvidenceItem:
    """One passage of text that mentions films in response to a seed."""

    #: "reddit" | "web"
    source: str
    #: Subreddit, site domain, or article title — who is speaking.
    source_name: str
    source_url: str | None
    #: The passage itself. Kept whole so the LLM can read *why* a film was named.
    text: str
    #: 0..1 — how much this kind of source is worth. See scoring.SOURCE_AUTHORITY.
    authority: float = 0.5

    def truncated(self, limit: int = 1200) -> str:
        return self.text[:limit]


@dataclass(slots=True)
class Candidate:
    """A film extracted from evidence and resolved through TMDB.

    Unresolved titles never become candidates — a recommendation Kaset can't
    link to a real film page is worse than no recommendation.
    """

    tmdb_id: int
    title: str
    year: str | None = None
    poster_path: str | None = None
    popularity: float | None = None
    genres: list[str] = field(default_factory=list)
    original_language: str | None = None

    #: Every passage that named this film.
    mentions: list[dict] = field(default_factory=list)

    @property
    def mention_count(self) -> int:
        return len(self.mentions)

    @property
    def distinct_sources(self) -> int:
        return len({m.get("source_name") for m in self.mentions if m.get("source_name")})

    @property
    def source_types(self) -> set[str]:
        return {m.get("source") for m in self.mentions if m.get("source")}
