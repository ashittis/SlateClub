import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


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
    # Whether other users should be able to see twin-score with me.
    twin_matching_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", foreign_keys=[user_id])


class UserTasteState(Base):
    """Single-row-per-user snapshot of LLM-derived taste data.

    Distinct from OnboardingSignals (which is frozen at onboarding
    time) — this row evolves as the user interacts with the app, and
    is rebuilt by the LLM layer on drift events.
    """

    __tablename__ = "user_taste_state"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Natural-language description, e.g. "Gravitates toward slow,
    # emotionally restrained films about memory and longing."
    taste_statement: Mapped[str | None] = mapped_column(Text, nullable=True)
    # OpenAI embedding of the taste statement (float32, packed bytes).
    # Cosine-matched against movie identity embeddings at request time.
    taste_embedding: Mapped[bytes | None] = mapped_column(
        LargeBinary, nullable=True
    )
    # 5-axis cinematic dimensions: pace, tone, structure, perspective,
    # emotional_register. Used as ranker features.
    tone_axes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    last_drift_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_computed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", foreign_keys=[user_id])


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column("passwordHash", String, nullable=True)
    name: Mapped[str] = mapped_column(String)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column("avatarUrl", String, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_id: Mapped[str | None] = mapped_column("googleId", String, unique=True, nullable=True)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
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
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    language_selections = relationship("LanguageSelection", back_populates="user", cascade="all, delete-orphan")
    favorite_people = relationship("FavoritePerson", back_populates="user", cascade="all, delete-orphan")
    favorite_movies = relationship("FavoriteMovie", back_populates="user", cascade="all, delete-orphan")
    onboarding_signals = relationship(
        "OnboardingSignals",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    preferences = relationship(
        "UserPreferences",
        cascade="all, delete-orphan",
        uselist=False,
    )
    activity_events = relationship("ActivityEvent", back_populates="user", cascade="all, delete-orphan")
    micro_feedbacks = relationship("MicroFeedback", back_populates="user", cascade="all, delete-orphan")
    calibration_responses = relationship("CalibrationResponse", back_populates="user", cascade="all, delete-orphan")
    following = relationship("Follow", foreign_keys="Follow.follower_id", back_populates="follower", cascade="all, delete-orphan")
    followers = relationship("Follow", foreign_keys="Follow.following_id", back_populates="following", cascade="all, delete-orphan")
