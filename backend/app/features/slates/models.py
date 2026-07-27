import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# Slate covers — vision describes mosaic_4, stack_3, spiral.
SLATE_COVER_LAYOUTS = ("mosaic_4", "stack_3", "spiral")
SLATE_VISIBILITIES = ("public", "unlisted", "private")
SLATE_COLLAB_ROLES = ("curator", "contributor")


class Slate(Base):
    """A user-curated film collection with optional collaborators."""

    __tablename__ = "slates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_layout: Mapped[str] = mapped_column(String, default="mosaic_4")
    visibility: Mapped[str] = mapped_column(String, default="public")
    is_collaborative: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    creator = relationship("User", foreign_keys=[creator_id])
    films = relationship(
        "SlateFilm",
        back_populates="slate",
        cascade="all, delete-orphan",
        order_by="SlateFilm.position",
    )
    collaborators = relationship(
        "SlateCollaborator", back_populates="slate", cascade="all, delete-orphan"
    )
    saves = relationship(
        "SlateSave", back_populates="slate", cascade="all, delete-orphan"
    )
    messages = relationship(
        "SlateRoomMessage",
        back_populates="slate",
        cascade="all, delete-orphan",
        order_by="SlateRoomMessage.created_at",
    )


class SlateFilm(Base):
    __tablename__ = "slate_films"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slate_id: Mapped[str] = mapped_column(
        String, ForeignKey("slates.id", ondelete="CASCADE"), index=True
    )
    tmdb_id: Mapped[int] = mapped_column(Integer)
    # "movie" | "tv" — TMDB movie & TV ids collide, so uniqueness is composite.
    media_type: Mapped[str] = mapped_column("mediaType", String, default="movie")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    added_by_user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE")
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    slate = relationship("Slate", back_populates="films")

    __table_args__ = (UniqueConstraint("slate_id", "tmdb_id", "mediaType"),)


class SlateCollaborator(Base):
    __tablename__ = "slate_collaborators"

    slate_id: Mapped[str] = mapped_column(
        String, ForeignKey("slates.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String, default="contributor")
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    slate = relationship("Slate", back_populates="collaborators")


class SlateLike(Base):
    """A heart on a slate — distinct from Save (bookmark)."""

    __tablename__ = "slate_likes"

    slate_id: Mapped[str] = mapped_column(
        "slateId", String, ForeignKey("slates.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    slate = relationship("Slate")


class SlateSave(Base):
    __tablename__ = "slate_saves"

    slate_id: Mapped[str] = mapped_column(
        String, ForeignKey("slates.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    slate = relationship("Slate", back_populates="saves")


class SlateRoomMessage(Base):
    __tablename__ = "slate_room_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slate_id: Mapped[str] = mapped_column(
        String, ForeignKey("slates.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("slate_room_messages.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    slate = relationship("Slate", back_populates="messages")
