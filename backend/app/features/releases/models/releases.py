import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Release(Base):
    """
    A scheduled release of a film on a platform/region.
    Sourced from TMDB's release_dates endpoint plus manual seeds.
    """

    __tablename__ = "releases"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    region: Mapped[str] = mapped_column(String, default="IN")
    platform: Mapped[str] = mapped_column(String)  # netflix, prime, mubi, hotstar, theatre, …
    release_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_releases_region_date", "region", "release_date"),
    )
