import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Movie(Base):
    """A film — the central content object in Kaset.

    Rows are created lazily: the first time anyone searches, opens or logs a
    TMDB title, `shared/services/films` upserts it here. Kaset never
    pre-imports a catalog.
    """

    __tablename__ = "movies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tmdb_id: Mapped[int] = mapped_column("tmdbId", Integer, index=True)
    title: Mapped[str] = mapped_column(String)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    poster_path: Mapped[str | None] = mapped_column("posterPath", String, nullable=True)
    backdrop_path: Mapped[str | None] = mapped_column("backdropPath", String, nullable=True)
    release_date: Mapped[str | None] = mapped_column("releaseDate", String, nullable=True)
    runtime: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vote_average: Mapped[float | None] = mapped_column("voteAverage", Float, nullable=True)
    vote_count: Mapped[int | None] = mapped_column("voteCount", Integer, nullable=True)
    popularity: Mapped[float | None] = mapped_column(Float, nullable=True)
    original_language: Mapped[str | None] = mapped_column("originalLanguage", String, nullable=True)
    genres: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    credits: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    ratings = relationship("Rating", back_populates="movie", cascade="all, delete-orphan")
    watchlist = relationship("WatchlistItem", back_populates="movie", cascade="all, delete-orphan")
    watch_history = relationship("WatchHistory", back_populates="movie", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="movie", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("tmdbId"),)
