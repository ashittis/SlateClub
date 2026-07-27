import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


WATCH_PARTY_STATUSES = ("scheduled", "live", "ended")


class WatchParty(Base):
    __tablename__ = "watch_parties"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    host_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String, default="scheduled")
    # Playback cursor in seconds — the host's current position. Polled
    # by participants every 5s until WebSockets land.
    playback_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    playback_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    participants = relationship(
        "WatchPartyParticipant",
        back_populates="party",
        cascade="all, delete-orphan",
    )
    reactions = relationship(
        "WatchPartyReaction",
        back_populates="party",
        cascade="all, delete-orphan",
    )


class WatchPartyParticipant(Base):
    __tablename__ = "watch_party_participants"

    party_id: Mapped[str] = mapped_column(
        String, ForeignKey("watch_parties.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    party = relationship("WatchParty", back_populates="participants")


class WatchPartyReaction(Base):
    """Time-coded reactions during the watch — emoji or short text."""

    __tablename__ = "watch_party_reactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    party_id: Mapped[str] = mapped_column(
        String, ForeignKey("watch_parties.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(Text)
    playback_seconds: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    party = relationship("WatchParty", back_populates="reactions")
