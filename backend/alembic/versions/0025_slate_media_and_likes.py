"""Slate media_type on films + slate_likes.

- slate_films: add mediaType ('movie'|'tv') so series belong in slates; swap the
  unique (slate_id, tmdb_id) for (slate_id, tmdb_id, mediaType).
- new slate_likes table (heart, distinct from save/bookmark).

Revision ID: 0025_slate_media_and_likes
Revises: 0024_series_support
Create Date: 2026-06-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0025_slate_media_and_likes"
down_revision = "0024_series_support"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "slate_films",
        sa.Column("mediaType", sa.String(), nullable=False, server_default="movie"),
    )
    op.drop_constraint("slate_films_slate_id_tmdb_id_key", "slate_films", type_="unique")
    op.create_unique_constraint(
        "uq_slate_films_slate_tmdb_media",
        "slate_films",
        ["slate_id", "tmdb_id", "mediaType"],
    )

    op.create_table(
        "slate_likes",
        sa.Column("slateId", sa.String(), sa.ForeignKey("slates.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("userId", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("slate_likes")
    op.drop_constraint("uq_slate_films_slate_tmdb_media", "slate_films", type_="unique")
    op.create_unique_constraint(
        "slate_films_slate_id_tmdb_id_key", "slate_films", ["slate_id", "tmdb_id"]
    )
    op.drop_column("slate_films", "mediaType")
