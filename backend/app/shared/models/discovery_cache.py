from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DiscoveryCache(Base):
    """Cached Community Intelligence pool per seed film, per month.

    Backs the Community Intelligence Engine: a seed film's web-sourced community
    recommendation consensus (Reddit + web search → grounded mention frequency →
    LLM reasoning). Expensive to build (multi-source scrape + 2 LLM calls), so it
    is warmed offline / off-response and read from here on the request path.

    Composite PK (seed_tmdb_id, month) mirrors reddit_cache: a lookup for the
    current month misses automatically at month boundaries, so freshness needs no
    TTL column and no sweeper (community talk accretes over time). `version`
    invalidates all rows when the scrape queries or scoring change.

    Personalization is NOT stored here — it's per-user and computed at request
    time from this shared community pool.
    """

    __tablename__ = "discovery_cache"

    seed_tmdb_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    month: Mapped[str] = mapped_column(String(7), primary_key=True)  # "YYYY-MM"
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)  # {seed, essence, candidates}
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
