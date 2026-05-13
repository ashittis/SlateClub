import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


CIRCLE_MAX_MEMBERS = 12
CIRCLE_MIN_MEMBERS = 2


class TasteCircle(Base):
    """Private group of 2–12 close-friends for film culture."""

    __tablename__ = "taste_circles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_members: Mapped[int] = mapped_column(Integer, default=CIRCLE_MAX_MEMBERS)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    members = relationship(
        "TasteCircleMember",
        back_populates="circle",
        cascade="all, delete-orphan",
    )
    messages = relationship(
        "TasteCircleMessage",
        back_populates="circle",
        cascade="all, delete-orphan",
        order_by="TasteCircleMessage.created_at",
    )


class TasteCircleMember(Base):
    __tablename__ = "taste_circle_members"

    circle_id: Mapped[str] = mapped_column(
        String, ForeignKey("taste_circles.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String, default="member")  # member | admin
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    circle = relationship("TasteCircle", back_populates="members")


class TasteCircleMessage(Base):
    __tablename__ = "taste_circle_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    circle_id: Mapped[str] = mapped_column(
        String, ForeignKey("taste_circles.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(Text)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    circle = relationship("TasteCircle", back_populates="messages")
