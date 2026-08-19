"""Everything a user does to a film: rate it, save it, watch it, log it, review it.

The distinction that matters most in Kaset:

  Rating       — the user's *current* opinion of a film. One row per (user, film).
  DiaryEntry   — one row per *viewing*. Rewatches are separate dated rows and
                 nothing ever overwrites an earlier one.
  WatchHistory — a derived summary ("has this user seen it?"), maintained by
                 diary_service so readers don't have to aggregate the diary.

`diary_service` is the single writer for the diary/rating/watch-history trio.
Routes must not write these tables directly.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import ARRAY, Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Rating(Base):
    """The user's current rating for a film (0.25–5.0, quarter-star steps)."""

    __tablename__ = "ratings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    value: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="ratings")
    movie = relationship("Movie", back_populates="ratings")

    __table_args__ = (UniqueConstraint("userId", "movieId"),)


class WatchlistItem(Base):
    """A film on the user's single default watchlist. Named collections are a
    separate concept (see the watchlists slice)."""

    __tablename__ = "watchlist_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    # Why the user saved this film (all optional).
    reason_type: Mapped[str | None] = mapped_column("reasonType", String, nullable=True)
    reason_reference: Mapped[str | None] = mapped_column("reasonReference", String, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="watchlist")
    movie = relationship("Movie", back_populates="watchlist")

    __table_args__ = (UniqueConstraint("userId", "movieId"),)


class WatchHistory(Base):
    """Derived one-row-per-(user, film) summary of the diary.

    Exists so "has this user seen it?" is a single indexed lookup rather than a
    diary aggregation — Home, the Passport and discovery all need it cheaply.
    Written only by diary_service, which keeps it in step with the diary.
    """

    __tablename__ = "watch_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    completion_pct: Mapped[float] = mapped_column("completionPct", Float, default=0.0)
    watched_at: Mapped[datetime] = mapped_column("watchedAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="watch_history")
    movie = relationship("Movie", back_populates="watch_history")

    __table_args__ = (UniqueConstraint("userId", "movieId"),)


#: How a viewing happened. Kept as a plain string rather than a PG enum so
#: adding a value later is a code change, not a migration with a lock.
WATCH_TYPES = ("theatre", "streaming", "tv", "other")


class DiaryEntry(Base):
    """One row per *viewing* — the central personal object in Kaset.

    Deliberately has **no unique constraint** on (user, film): watching
    Interstellar in 2024 and again in 2026 is two rows, both preserved forever.
    A new log never overwrites an earlier one. This is the model's whole point.

    `rating` is the snapshot taken at that viewing, which is what the diary and
    Passport display; the user's *current* opinion lives in `ratings`. The two
    legitimately diverge — you can rate a film 3 in 2024 and 5 on rewatch, and
    the diary should still show what you thought at the time.

    Theatre details are denormalised onto the row rather than pointing at a
    theatres table: V1 keeps this simple (KASET.md §8), and a theatre visit is a
    memory of a place, not a foreign key that needs to stay canonical.

    Coexistence rule (see shared/services/diary_service.py): every write here
    also upserts the WatchHistory summary, and a delete drops that summary only
    when it was the last remaining viewing.
    """

    __tablename__ = "diary_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column(String, ForeignKey("movies.id", ondelete="CASCADE"))

    #: The date the user says they watched it — a calendar date, not an instant.
    #: A viewing belongs to a day; storing a timestamp invited timezone bugs
    #: where a late-night log landed on tomorrow's date.
    watched_on: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(timezone.utc).date())

    #: Rating captured at log time (0.25–5.0). NULL if logged without rating.
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)

    #: Affection, which is not the same axis as quality — a 3-star comfort
    #: rewatch can still be loved. Snapshotted per viewing exactly like `rating`.
    liked: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    is_rewatch: Mapped[bool] = mapped_column(Boolean, default=False)

    #: Free-text labels on this viewing ("imax", "with-dad"). Normalised by
    #: diary_service, never written raw. An array rather than a join table
    #: because V1 displays tags but does not query by them.
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default=text("'{}'::varchar[]")
    )

    #: One of WATCH_TYPES.
    watch_type: Mapped[str] = mapped_column(String, default="streaming")
    #: Only meaningful when watch_type == "theatre"; all optional even then.
    theatre_name: Mapped[str | None] = mapped_column(String, nullable=True)
    theatre_city: Mapped[str | None] = mapped_column(String, nullable=True)
    theatre_format: Mapped[str | None] = mapped_column(String, nullable=True)

    #: "public" | "private" — private viewings are hidden from other users and
    #: their feeds, but stay visible to the owner and count in their Wrapped.
    visibility: Mapped[str] = mapped_column(String, default="public")

    #: SET NULL rather than CASCADE: deleting a review must not delete the
    #: viewing it described. The viewing happened either way.
    review_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("reviews.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    movie = relationship("Movie")

    __table_args__ = (
        Index("ix_diary_user_watched", "user_id", "watched_on"),
        Index("ix_diary_user_movie", "user_id", "movie_id"),
    )


class CurrentlyWatching(Base):
    """A film the user has started but not yet finished. Kept separate from
    watch_history so "watched" semantics stay unambiguous."""

    __tablename__ = "currently_watching"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    progress_pct: Mapped[float] = mapped_column("progressPct", Float, default=0.0)
    started_at: Mapped[datetime] = mapped_column("startedAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User")
    movie = relationship("Movie")

    __table_args__ = (UniqueConstraint("userId", "movieId"),)



class Review(Base):
    """Written thoughts on a film. A review belongs to the viewing that
    prompted it — DiaryEntry.review_id is the link, set when the user writes a
    review as part of logging."""

    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column(String, ForeignKey("movies.id", ondelete="CASCADE"))
    #: The viewing this review came out of, when it was written as part of
    #: logging. SET NULL rather than CASCADE — deleting a viewing shouldn't
    #: silently destroy the writing that came with it.
    #:
    #: `use_alter` because reviews and diary_entries point at each other: the
    #: constraint is added after both tables exist, instead of deadlocking
    #: table-creation order.
    diary_entry_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey(
            "diary_entries.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_reviews_diary_entry",
        ),
        nullable=True,
    )
    body: Mapped[str] = mapped_column(Text)
    spoiler: Mapped[bool] = mapped_column(Boolean, default=False)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="reviews")
    movie = relationship("Movie", back_populates="reviews")

    __table_args__ = (UniqueConstraint("user_id", "movie_id"),)
