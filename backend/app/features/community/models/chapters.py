import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Chapter(Base):
    """City-level public community ('Hyderabad Cinema Lovers')."""

    __tablename__ = "chapters"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    region: Mapped[str] = mapped_column(String, default="IN")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    members = relationship(
        "ChapterMember", back_populates="chapter", cascade="all, delete-orphan"
    )
    events = relationship(
        "ChapterEvent",
        back_populates="chapter",
        cascade="all, delete-orphan",
        order_by="ChapterEvent.starts_at",
    )


class ChapterMember(Base):
    __tablename__ = "chapter_members"

    chapter_id: Mapped[str] = mapped_column(
        String, ForeignKey("chapters.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    chapter = relationship("Chapter", back_populates="members")


class ChapterEvent(Base):
    """Local screenings, meetups, festival travel — anything geo-local."""

    __tablename__ = "chapter_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chapter_id: Mapped[str] = mapped_column(
        String, ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    venue: Mapped[str | None] = mapped_column(String, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    chapter = relationship("Chapter", back_populates="events")
