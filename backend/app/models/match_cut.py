import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class MatchCut(Base):
    """A saved, invitable 'blend' — members' tastes are combined into a
    consensus film list (Spotify Blend for movies)."""

    __tablename__ = "match_cuts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String)
    invite_token: Mapped[str] = mapped_column(String, unique=True, default=lambda: secrets.token_urlsafe(9))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MatchCutMember(Base):
    __tablename__ = "match_cut_members"

    cut_id: Mapped[str] = mapped_column(String, ForeignKey("match_cuts.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
