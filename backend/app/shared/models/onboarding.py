import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LanguageSelection(Base):
    __tablename__ = "language_selections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    language: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="language_selections")

    __table_args__ = (UniqueConstraint("user_id", "language"),)


class FavoritePerson(Base):
    __tablename__ = "favorite_people"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    tmdb_id: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String)
    profile_path: Mapped[str | None] = mapped_column(String, nullable=True)
    known_for: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="favorite_people")

    __table_args__ = (UniqueConstraint("user_id", "tmdb_id"),)


class FavoriteMovie(Base):
    __tablename__ = "favorite_movies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    tmdb_id: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String)
    poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="favorite_movies")

    __table_args__ = (UniqueConstraint("user_id", "tmdb_id"),)


class OnboardingSignals(Base):
    """
    Single row per user holding the additional signals captured by the
    8-step "Tune Your Taste" onboarding (poster gut test, mood sliders,
    platforms, origin film, completion timestamps).
    """

    __tablename__ = "onboarding_signals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    # Poster gut test — list of TMDB ids the user picked from the curated set.
    poster_picks: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)

    # Mood sliders — each in [-1.0, 1.0]; centre = 0.
    mood_pacing: Mapped[float | None] = mapped_column(Float, nullable=True)
    mood_tone: Mapped[float | None] = mapped_column(Float, nullable=True)
    mood_realism: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Streaming platforms the user has access to.
    platforms: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    prefers_theatres: Mapped[bool | None] = mapped_column(default=False)

    # Cinema origin story — single anchor film.
    origin_film_tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    welcomed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ready_shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="onboarding_signals", uselist=False)
