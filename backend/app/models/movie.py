import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Movie(Base):
    """A title — film or TV series. `media_type` discriminates the two; TMDB
    movie and TV ids share an integer space, so uniqueness is composite."""

    __tablename__ = "movies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tmdb_id: Mapped[int] = mapped_column("tmdbId", Integer, index=True)
    media_type: Mapped[str] = mapped_column("mediaType", String, default="movie", index=True)
    number_of_seasons: Mapped[int | None] = mapped_column("numberOfSeasons", Integer, nullable=True)
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
    # OpenAI-extracted MovieIdentity (vibe, themes, experiential_paragraph,
    # affect_axes, affect_vector, comparable_by_feel). See app/ml/llm/movie_identity.py.
    identity_json: Mapped[dict | None] = mapped_column("identityJson", JSON, nullable=True)
    # Float32 embedding of the identity summary, packed via numpy.tobytes().
    # NULL until the extraction job has run for this movie.
    identity_embedding: Mapped[bytes | None] = mapped_column(
        "identityEmbedding", LargeBinary, nullable=True
    )
    identity_updated_at: Mapped[datetime | None] = mapped_column(
        "identityUpdatedAt", DateTime(timezone=True), nullable=True
    )
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

    __table_args__ = (UniqueConstraint("tmdbId", "mediaType"),)
