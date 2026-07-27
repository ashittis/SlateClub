import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


REACTION_KINDS = ("like", "agree", "disagree")
REVIEW_VOTE_KINDS = ("agree", "disagree")


class HotTake(Base):
    """Short-form (≤280 char) post. Optionally targets a film."""

    __tablename__ = "hot_takes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    body: Mapped[str] = mapped_column(String(280))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    user = relationship("User", foreign_keys=[user_id])
    reactions = relationship(
        "HotTakeReaction", back_populates="hot_take", cascade="all, delete-orphan"
    )


class HotTakeReaction(Base):
    __tablename__ = "hot_take_reactions"

    hot_take_id: Mapped[str] = mapped_column(
        String, ForeignKey("hot_takes.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    hot_take = relationship("HotTake", back_populates="reactions")


class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    question: Mapped[str] = mapped_column(String)
    options: Mapped[list[str]] = mapped_column(JSON)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    votes = relationship(
        "PollVote", back_populates="poll", cascade="all, delete-orphan"
    )


class PollVote(Base):
    __tablename__ = "poll_votes"

    poll_id: Mapped[str] = mapped_column(
        String, ForeignKey("polls.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    option_index: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    poll = relationship("Poll", back_populates="votes")


class ReviewVote(Base):
    """Per-user Agree/Disagree vote on a Review (separate from helpful_count)."""

    __tablename__ = "review_votes"

    review_id: Mapped[str] = mapped_column(
        String, ForeignKey("reviews.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String)  # agree | disagree
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
