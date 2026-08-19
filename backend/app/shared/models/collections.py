"""Watchlists and Blends — films gathered on purpose.

Two ways of collecting films that Kaset keeps deliberately separate from the
diary. The diary records what happened; these record intent and shared taste.

**Watchlist vs. watchlists.** Every user has one implicit watchlist
(`watchlist_items`) — the "save this for later" button. A `Watchlist` here is a
*named collection* the user made on purpose: "Films to watch with Dad", "1970s
paranoia". Conflating them would mean adding a film to a themed list also marked
it as something you intend to watch next, which isn't true.
"""

import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _invite_token() -> str:
    return secrets.token_urlsafe(9)


class Watchlist(Base):
    """A named, ordered collection of films."""

    __tablename__ = "watchlists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: "public" | "private" — a private list is invisible to everyone else.
    visibility: Mapped[str] = mapped_column(String, default="public")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    films = relationship(
        "WatchlistFilm",
        back_populates="watchlist",
        cascade="all, delete-orphan",
        order_by="WatchlistFilm.position",
    )


class WatchlistFilm(Base):
    """One film in a named collection.

    Stores its own title and poster rather than joining `movies`: a list should
    render without resolving every film first, and a curated list is a snapshot
    of what the user chose to put in it.
    """

    __tablename__ = "watchlist_films"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    watchlist_id: Mapped[str] = mapped_column(
        String, ForeignKey("watchlists.id", ondelete="CASCADE"), index=True
    )
    tmdb_id: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String)
    poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    year: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The user's own ordering — a curated list is ordered on purpose.
    position: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    watchlist = relationship("Watchlist", back_populates="films")

    __table_args__ = (
        UniqueConstraint("watchlist_id", "tmdb_id"),
        Index("ix_watchlist_films_order", "watchlist_id", "position"),
    )


class Blend(Base):
    """Two or more people's taste, combined into shared recommendations.

    Joined by link rather than invitation: `invite_token` is the whole access
    model. Kaset's follow graph is one-directional, so there's no mutual-friend
    set to invite from, and a shareable link is what people actually do.
    """

    __tablename__ = "blends"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String, default="Blend")
    invite_token: Mapped[str] = mapped_column(String, unique=True, index=True, default=_invite_token)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    members = relationship("BlendMember", back_populates="blend", cascade="all, delete-orphan")


class BlendMember(Base):
    __tablename__ = "blend_members"

    blend_id: Mapped[str] = mapped_column(
        String, ForeignKey("blends.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    blend = relationship("Blend", back_populates="members")
