"""The social graph and the activity stream.

Kaset's social layer is deliberately small: you follow people, and you see
what they logged. Conversations and messages live in the community slice;
notifications live in their own slice.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Follow(Base):
    """A one-directional follow. Mutual follows are simply two rows —
    there is no friend-request handshake in Kaset."""

    __tablename__ = "follows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    follower_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    following_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following = relationship("User", foreign_keys=[following_id], back_populates="followers")

    __table_args__ = (UniqueConstraint("follower_id", "following_id"),)


class ActivityEvent(Base):
    """One entry in a user's public activity stream.

    `target_id` is polymorphic (a review, a watchlist, another user) and
    deliberately carries no FK, so a deleted target leaves a dead reference
    rather than cascading away someone's history. Readers must tolerate a
    target that no longer resolves.
    """

    __tablename__ = "activity_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    # logged | rated | reviewed | watchlisted | followed
    type: Mapped[str] = mapped_column(String)
    movie_id: Mapped[str | None] = mapped_column(String, nullable=True)
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="activity_events")

    __table_args__ = (Index("ix_activity_user_created", "user_id", "created_at"),)
