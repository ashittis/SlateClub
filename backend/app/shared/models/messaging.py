"""Direct messages — one model, films included.

SlateClub ran three parallel messaging systems: `chat_conversations`/
`chat_messages` for real threaded DMs, `film_dms` for one-shot "recommend this
film" objects with a fixed reaction set, and two group chats attached to circles
and slates. Sharing a film and talking about it were different tables, so a
recommendation couldn't be replied to and a conversation couldn't carry a film.

Kaset has one: a conversation holds messages, and **a shared film is a message**
(`shared_movie_id`) rather than a separate object. That is what lets someone
send a film and then actually discuss it (KASET.md §8).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Conversation(Base):
    """A thread between exactly two people.

    The pair is stored canonically (`user_a_id` < `user_b_id` lexicographically)
    so (A,B) and (B,A) can't both exist. The old table had the same intent but
    left ordering to the caller, which made the unique constraint decorative.
    """

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_a_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    user_b_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Denormalised so the inbox list doesn't need a message join per row.
    last_preview: Mapped[str | None] = mapped_column(String(140), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id"),
        Index("ix_conversations_recent", "last_message_at"),
    )

    @staticmethod
    def pair(one: str, two: str) -> tuple[str, str]:
        """Canonical ordering for a user pair. Always build conversations
        through this so the unique constraint actually holds."""
        return (one, two) if one < two else (two, one)


class Message(Base):
    """One message. Carries text, a shared film, or both.

    A film share is just a message with `shared_movie_id` set — so it appears in
    the thread in order, can be replied to, and needs no separate inbox.
    """

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    #: Optional: a message may be a bare film share with no words.
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The film being shared, rendered as a rich card in the thread.
    shared_movie_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("movies.id", ondelete="SET NULL"), nullable=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (Index("ix_messages_thread", "conversation_id", "created_at"),)
