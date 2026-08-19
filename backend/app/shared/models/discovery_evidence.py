"""Persisted evidence — why a film was ever recommended.

Kaset's discovery is only as trustworthy as its traceability. This table keeps
the trail: which source named which candidate for which seed, in what words,
with what authority (KASET.md §9).

It exists for three reasons: to explain a recommendation to a user, to let the
scoring weights be evaluated against real outcomes later, and so that a strange
result can be diagnosed rather than shrugged at.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DiscoveryEvidence(Base):
    __tablename__ = "discovery_evidence"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    seed_tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    candidate_tmdb_id: Mapped[int] = mapped_column(Integer)

    #: The candidate's own metadata, denormalised.
    #:
    #: This is a warm *cache*, not a normalised store, so repeating a film's
    #: title across its mentions is the right trade: it lets the request path
    #: rebuild a rankable pool with zero network calls. Without it the pool comes
    #: back as bare ids — the evaluator can't name the films it is ranking and
    #: scoring has no metadata for contextual similarity.
    candidate_title: Mapped[str] = mapped_column(String, default="")
    candidate_year: Mapped[str | None] = mapped_column(String, nullable=True)
    candidate_poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    candidate_popularity: Mapped[float | None] = mapped_column(Float, nullable=True)
    candidate_language: Mapped[str | None] = mapped_column(String, nullable=True)
    candidate_genres: Mapped[list | None] = mapped_column(JSON, nullable=True)

    #: "reddit" | "web"
    source: Mapped[str] = mapped_column(String)
    #: Subreddit or site domain.
    source_name: Mapped[str | None] = mapped_column(String, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)

    #: The reason the source gave, in its own words.
    mention_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    mention_count: Mapped[int] = mapped_column(Integer, default=1)
    authority_weight: Mapped[float] = mapped_column(Float, default=0.5)
    sentiment: Mapped[str | None] = mapped_column(String, nullable=True)

    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("ix_evidence_seed_candidate", "seed_tmdb_id", "candidate_tmdb_id"),)
