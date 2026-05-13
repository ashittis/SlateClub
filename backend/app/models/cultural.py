import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class CulturalContext(Base):
    """
    Optional pre-watch context for a film — historical, cultural,
    or political background that helps non-local viewers engage.
    Manual or LLM-seeded.
    """

    __tablename__ = "cultural_contexts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tmdb_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    headline: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (UniqueConstraint("tmdb_id"),)
