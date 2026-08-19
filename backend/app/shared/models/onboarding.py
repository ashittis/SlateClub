"""Cold-start taste signals, captured during onboarding.

Kaset's onboarding exists for one reason: give discovery something to work with
on day one (KASET.md §8). It stores structured facts only — languages, favourite
films, favourite people, basic viewing preferences — and nothing inferred.

These tables outlive onboarding. The Passport reads favourites, and the
discovery engine's FOR YOU lens reads all four.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LanguageSelection(Base):
    """A language the user wants to see films in."""

    __tablename__ = "language_selections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    language: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="language_selections")

    __table_args__ = (UniqueConstraint("user_id", "language"),)


class FavoritePerson(Base):
    """A favourite actor or director. Shown on the Passport, and used as a
    taste signal by discovery. `position` preserves the user's own ordering."""

    __tablename__ = "favorite_people"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    tmdb_id: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String)
    profile_path: Mapped[str | None] = mapped_column(String, nullable=True)
    # TMDB's known_for_department: "Acting", "Directing", "Writing", …
    known_for: Mapped[str] = mapped_column(String)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="favorite_people")

    __table_args__ = (UniqueConstraint("user_id", "tmdb_id"),)


class FavoriteMovie(Base):
    """A favourite film. Distinct from a 5-star rating: this is identity, not
    a score, and the user curates the list by hand."""

    __tablename__ = "favorite_movies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    tmdb_id: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String)
    poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="favorite_movies")

    __table_args__ = (UniqueConstraint("user_id", "tmdb_id"),)


class ViewingPreferences(Base):
    """How the user watches — the optional fourth onboarding step.

    Replaces SlateClub's `onboarding_signals`, which also carried a poster gut
    test, three mood sliders and an "origin film". Those fed the 25-dimensional
    taste vector, which no longer exists; keeping them would mean asking users
    questions nothing reads.

    Every field here is genuinely optional — onboarding must be completable by
    skipping this step entirely.
    """

    __tablename__ = "viewing_preferences"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Streaming services the user has access to, e.g. ["netflix", "mubi"].
    platforms: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    prefers_theatre: Mapped[bool] = mapped_column(Boolean, default=False)
    # Decades the user gravitates to, as start years: [1970, 1990].
    preferred_decades: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="viewing_preferences", uselist=False)
