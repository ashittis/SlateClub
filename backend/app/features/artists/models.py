import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


ARTIST_POST_KINDS = (
    "trailer",
    "still",
    "behind_scenes",
    "recommendation",
    "watchlist_share",
)
AMA_STATUSES = ("scheduled", "live", "ended")


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tmdb_person_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    headshot_url: Mapped[str | None] = mapped_column(String, nullable=True)
    roles: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    claimed_by_user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    awards: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    posts = relationship("ArtistPost", back_populates="artist", cascade="all, delete-orphan")
    amas = relationship("AMA", back_populates="artist", cascade="all, delete-orphan")


class ArtistPost(Base):
    __tablename__ = "artist_posts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    artist_id: Mapped[str] = mapped_column(
        String, ForeignKey("artists.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url: Mapped[str | None] = mapped_column(String, nullable=True)
    linked_film_tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    artist = relationship("Artist", back_populates="posts")


class AMA(Base):
    __tablename__ = "amas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    artist_id: Mapped[str] = mapped_column(
        String, ForeignKey("artists.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String, default="scheduled")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    artist = relationship("Artist", back_populates="amas")
    questions = relationship(
        "AMAQuestion", back_populates="ama", cascade="all, delete-orphan"
    )


class AMAQuestion(Base):
    __tablename__ = "ama_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ama_id: Mapped[str] = mapped_column(
        String, ForeignKey("amas.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE")
    )
    question: Mapped[str] = mapped_column(Text)
    answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    answer_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    ama = relationship("AMA", back_populates="questions")


class ArtistFollow(Base):
    __tablename__ = "artist_follows"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    artist_id: Mapped[str] = mapped_column(
        String, ForeignKey("artists.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
