"""releases table.

Revision ID: 0008_releases
Revises: 0007_artists
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0008_releases"
down_revision = "0007_artists"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "releases",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tmdb_id", sa.Integer(), nullable=False),
        sa.Column("region", sa.String(), nullable=False, server_default="IN"),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("release_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("poster_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_releases_tmdb_id", "releases", ["tmdb_id"])
    op.create_index("ix_releases_release_date", "releases", ["release_date"])
    op.create_index("ix_releases_region_date", "releases", ["region", "release_date"])


def downgrade() -> None:
    op.drop_index("ix_releases_region_date", table_name="releases")
    op.drop_index("ix_releases_release_date", table_name="releases")
    op.drop_index("ix_releases_tmdb_id", table_name="releases")
    op.drop_table("releases")
