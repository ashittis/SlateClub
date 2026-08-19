import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserPreferences(Base):
    """Per-user toggles surfaced in Settings."""

    __tablename__ = "user_preferences"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Notification kind opt-outs.
    notif_opt_out: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # Profile visibility: public | followers | private.
    profile_visibility: Mapped[str] = mapped_column(String, default="public")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="preferences")


class User(Base):
    """The account. Everything a user does hangs off this row via CASCADE, so
    deleting a user removes their entire footprint — there is no soft-delete."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    # Nullable so an OAuth-only account is representable.
    password_hash: Mapped[str | None] = mapped_column("passwordHash", String, nullable=True)
    name: Mapped[str] = mapped_column(String)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column("avatarUrl", String, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_id: Mapped[str | None] = mapped_column("googleId", String, unique=True, nullable=True)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    # User-stated home city — shown on the Passport and used to prefill the
    # theatre field when logging a theatre visit.
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    ratings = relationship("Rating", back_populates="user", cascade="all, delete-orphan")
    watchlist = relationship("WatchlistItem", back_populates="user", cascade="all, delete-orphan")
    watch_history = relationship("WatchHistory", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    language_selections = relationship("LanguageSelection", back_populates="user", cascade="all, delete-orphan")
    favorite_people = relationship("FavoritePerson", back_populates="user", cascade="all, delete-orphan")
    favorite_movies = relationship("FavoriteMovie", back_populates="user", cascade="all, delete-orphan")
    viewing_preferences = relationship(
        "ViewingPreferences",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    preferences = relationship(
        "UserPreferences",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    activity_events = relationship("ActivityEvent", back_populates="user", cascade="all, delete-orphan")
    following = relationship("Follow", foreign_keys="Follow.follower_id", back_populates="follower", cascade="all, delete-orphan")
    followers = relationship("Follow", foreign_keys="Follow.following_id", back_populates="following", cascade="all, delete-orphan")
