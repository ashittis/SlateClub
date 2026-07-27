from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RedditCache(Base):
    """Cached Reddit discussion text per film, per month. Composite PK
    (tmdb_id, month) means a lookup for the current month misses automatically
    at month boundaries — so freshness needs no TTL column and no sweeper.
    `version` invalidates all rows when the regex or sub list changes."""

    __tablename__ = "reddit_cache"

    tmdb_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    month: Mapped[str] = mapped_column(String(7), primary_key=True)  # "YYYY-MM"
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)  # {text, sentences, fetched_at}
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
