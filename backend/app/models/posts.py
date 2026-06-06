import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


POST_TYPES = ("text", "question")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    post_type: Mapped[str] = mapped_column(String, default="text")  # text | question
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    reply_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    user = relationship("User", foreign_keys=[user_id])
    replies = relationship("PostReply", back_populates="post", cascade="all, delete-orphan")
    upvotes = relationship("PostUpvote", back_populates="post", cascade="all, delete-orphan")


class PostReply(Base):
    __tablename__ = "post_replies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id: Mapped[str] = mapped_column(
        String, ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    post = relationship("Post", back_populates="replies")
    user = relationship("User", foreign_keys=[user_id])


class PostUpvote(Base):
    __tablename__ = "post_upvotes"

    post_id: Mapped[str] = mapped_column(
        String, ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    post = relationship("Post", back_populates="upvotes")
