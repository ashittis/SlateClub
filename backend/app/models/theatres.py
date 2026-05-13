import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class Theatre(Base):
    __tablename__ = "theatres"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String)
    chain: Mapped[str | None] = mapped_column(String, nullable=True)  # PVR, INOX, etc.
    city: Mapped[str] = mapped_column(String, index=True)
    region: Mapped[str] = mapped_column(String, default="IN")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Showtime(Base):
    __tablename__ = "showtimes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    theatre_id: Mapped[str] = mapped_column(String, index=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    booking_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_showtimes_film_starts", "tmdb_id", "starts_at"),
        Index("ix_showtimes_theatre_starts", "theatre_id", "starts_at"),
    )
