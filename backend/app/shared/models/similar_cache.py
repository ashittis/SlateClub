from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SimilarCache(Base):
    """Persisted 'movies like X' payload, keyed by seed TMDB id. Lets repeat
    requests skip the LLM. `version` gates freshness (bump to invalidate all)."""

    __tablename__ = "similar_cache"

    seed_tmdb_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[int] = mapped_column(Integer)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
