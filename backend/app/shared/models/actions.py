import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Rating(Base):
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
    __tablename__ = "watchlist_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    # Shelf Notes — why the user saved this film (all optional).
    reason_type: Mapped[str | None] = mapped_column("reasonType", String, nullable=True)
    reason_reference: Mapped[str | None] = mapped_column("reasonReference", String, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="watchlist")
    movie = relationship("Movie", back_populates="watchlist")

    __table_args__ = (UniqueConstraint("userId", "movieId"),)


class WatchHistory(Base):
    __tablename__ = "watch_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    completion_pct: Mapped[float] = mapped_column("completionPct", Float, default=0.0)
    watched_at: Mapped[datetime] = mapped_column("watchedAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="watch_history")
    movie = relationship("Movie", back_populates="watch_history")

    __table_args__ = (UniqueConstraint("userId", "movieId"),)


class DiaryEntry(Base):
    """One row per *viewing* of a film (Letterboxd-style diary). Unlike
    WatchHistory (one upserted summary row per user+movie), this table keeps
    every viewing — so rewatches are distinct dated entries. Each viewing can
    record where it happened (home vs theatre), a rating snapshot, whether it
    was a rewatch, and per-entry privacy. Forward-only relationships (DB-level
    cascade handles cleanup) so User/Movie models need no back-reference.

    Coexistence rule (see routes/diary.py): every write here also upserts the
    WatchHistory summary so the 9+ existing readers of watch_history keep
    working; a delete drops the summary only when it was the last diary row."""

    __tablename__ = "watch_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    watched_at: Mapped[datetime] = mapped_column("watchedAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    # Rating captured at log time (0.25–5.0). NULL if the user logged without rating.
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_rewatch: Mapped[bool] = mapped_column("isRewatch", Boolean, default=False)
    at_theatre: Mapped[bool] = mapped_column("atTheatre", Boolean, default=False)
    # "public" | "private" — private viewings are hidden from other users and
    # their feeds, but stay visible to the owner and count in the owner's Wrapped.
    visibility: Mapped[str] = mapped_column(String, default="public")
    review_id: Mapped[str | None] = mapped_column(
        "reviewId", String, ForeignKey("reviews.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    movie = relationship("Movie")

    __table_args__ = (
        Index("ix_watchlog_user_watched", "userId", "watchedAt"),
        Index("ix_watchlog_user_movie", "userId", "movieId"),
    )


class CurrentlyWatching(Base):
    """A film the user has started but not yet finished. One row per
    (user, movie); kept separate from watch_history so 'watched' semantics
    elsewhere stay untouched. Forward-only relationships — DB-level cascade
    handles cleanup, so User/Movie models need no back-reference."""

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


class DnfEntry(Base):
    """A film the user abandoned (Did Not Finish), with where they stopped
    and why. Strong negative signal — a MicroFeedback row is also written on
    DNF so the rec pipeline learns from it."""

    __tablename__ = "dnf_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    stopped_at: Mapped[str | None] = mapped_column("stoppedAt", String, nullable=True)
    progress_pct: Mapped[float | None] = mapped_column("progressPct", Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    movie = relationship("Movie")

    __table_args__ = (UniqueConstraint("userId", "movieId"),)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column(String, ForeignKey("movies.id", ondelete="CASCADE"))
    # 0 = whole title (film or series); >0 = a specific season's review. Episodes
    # never get reviews (they get a numeric rating + reaction instead).
    season_number: Mapped[int] = mapped_column("seasonNumber", Integer, default=0)
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
    comments = relationship("Comment", back_populates="review", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("user_id", "movie_id", "seasonNumber"),)


class SeasonRating(Base):
    """A star rating (0–5) for one season of a series."""

    __tablename__ = "season_ratings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    season_number: Mapped[int] = mapped_column("seasonNumber", Integer)
    value: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User")
    movie = relationship("Movie")

    __table_args__ = (UniqueConstraint("userId", "movieId", "seasonNumber"),)


class EpisodeRating(Base):
    """A numeric rating (1–10, IMDb-style) for one episode."""

    __tablename__ = "episode_ratings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    season_number: Mapped[int] = mapped_column("seasonNumber", Integer)
    episode_number: Mapped[int] = mapped_column("episodeNumber", Integer)
    value: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User")
    movie = relationship("Movie")

    __table_args__ = (UniqueConstraint("userId", "movieId", "seasonNumber", "episodeNumber"),)


class EpisodeReaction(Base):
    """A quick reaction (🔥 peak / 😭 devastating / etc.) for one episode."""

    __tablename__ = "episode_reactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column("movieId", String, ForeignKey("movies.id", ondelete="CASCADE"))
    season_number: Mapped[int] = mapped_column("seasonNumber", Integer)
    episode_number: Mapped[int] = mapped_column("episodeNumber", Integer)
    reaction: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    movie = relationship("Movie")

    __table_args__ = (UniqueConstraint("userId", "movieId", "seasonNumber", "episodeNumber"),)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    review_id: Mapped[str] = mapped_column(String, ForeignKey("reviews.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="comments")
    review = relationship("Review", back_populates="comments")
