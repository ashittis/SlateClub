import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Follow(Base):
    __tablename__ = "follows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    follower_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    following_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following = relationship("User", foreign_keys=[following_id], back_populates="followers")

    __table_args__ = (UniqueConstraint("follower_id", "following_id"),)


class OrbitRequest(Base):
    """A pending/answered 'add to orbit' (friend) request. On accept the
    routes create reciprocal Follow rows, so an accepted orbit == mutual follow."""

    __tablename__ = "orbit_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    from_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    to_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | accepted | declined
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("from_id", "to_id"),)


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String)  # rated, reviewed, watched, watchlisted, followed
    movie_id: Mapped[str | None] = mapped_column(String, nullable=True)
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="activity_events")

    __table_args__ = (Index("ix_activity_user_created", "user_id", "created_at"),)


class MicroFeedback(Base):
    __tablename__ = "micro_feedbacks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="micro_feedbacks")


class Impression(Base):
    """Logs every recommendation surfaced to a user.

    Required to train Phase B XGBoost on real implicit feedback —
    without impressions we can't compute "shown but not clicked"
    negatives. Free to capture now, impossible to backfill later.
    """

    __tablename__ = "impressions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[str] = mapped_column(String)
    surface: Mapped[str] = mapped_column(String)  # hero | swipe_stack | for_you | taste_cluster | might_surprise_you
    position: Mapped[int] = mapped_column(Integer)
    rank_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str | None] = mapped_column(String, nullable=True)  # content | als | semantic | trending | graph | per_lang | director
    # The exact 12-feature row that produced rank_score, captured at serve time.
    # NULL for impressions logged before this column existed — the eval harness
    # falls back to point-in-time reconstruction for those.
    features_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    shown_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_impressions_user_shown", "user_id", "shown_at"),
        Index("ix_impressions_movie_user", "movie_id", "user_id"),
    )


class CalibrationResponse(Base):
    __tablename__ = "calibration_responses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String)
    value: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="calibration_responses")
