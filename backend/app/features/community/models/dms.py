import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FilmDM(Base):
    """A film 'recommend' sent to a user's inbox. The recipient can reply with
    one of a fixed set of template reactions (no free text)."""

    __tablename__ = "film_dms"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    movie_id: Mapped[str] = mapped_column(String, ForeignKey("movies.id", ondelete="CASCADE"))
    reaction: Mapped[str | None] = mapped_column(String, nullable=True)  # peak|mid|never_again|worst_ever|absolute_worst
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
