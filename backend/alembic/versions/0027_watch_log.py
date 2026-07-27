"""Per-viewing diary entries (watch_log).

Adds watch_log — one row per viewing of a film — enabling rewatches, theatre
vs home venue, per-entry privacy, and a rating snapshot. WatchHistory remains
the derived one-row-per-(user,movie) summary that existing readers depend on.

Backfills one diary row per existing watch_history row (all treated as a
first, public, home viewing) with the user's current rating snapshotted in.

Revision ID: 0027_watch_log
Revises: 0026_user_geo
Create Date: 2026-07-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0027_watch_log"
down_revision = "0026_user_geo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "watch_log",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("userId", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("movieId", sa.String(), sa.ForeignKey("movies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("watchedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("isRewatch", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("atTheatre", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("visibility", sa.String(), nullable=False, server_default="public"),
        sa.Column("reviewId", sa.String(), sa.ForeignKey("reviews.id", ondelete="SET NULL"), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_watchlog_user_watched", "watch_log", ["userId", "watchedAt"])
    op.create_index("ix_watchlog_user_movie", "watch_log", ["userId", "movieId"])

    # Backfill: one diary row per existing watch_history row. Idempotent —
    # only inserts where no watch_log row already exists for the same
    # (user, movie, watchedAt), so re-running is safe.
    op.execute(
        """
        INSERT INTO watch_log
            (id, "userId", "movieId", "watchedAt", rating,
             "isRewatch", "atTheatre", visibility, "reviewId", "createdAt")
        SELECT
            md5(random()::text || wh.id),
            wh."userId",
            wh."movieId",
            wh."watchedAt",
            r.value,
            false,
            false,
            'public',
            NULL,
            wh."watchedAt"
        FROM watch_history wh
        LEFT JOIN ratings r
            ON r."userId" = wh."userId" AND r."movieId" = wh."movieId"
        WHERE NOT EXISTS (
            SELECT 1 FROM watch_log wl
            WHERE wl."userId" = wh."userId"
              AND wl."movieId" = wh."movieId"
              AND wl."watchedAt" = wh."watchedAt"
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_watchlog_user_movie", table_name="watch_log")
    op.drop_index("ix_watchlog_user_watched", table_name="watch_log")
    op.drop_table("watch_log")
