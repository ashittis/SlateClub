"""reddit_cache — cached Reddit discussion text per film per month.

Backs the offline movie-identity enrichment (Task 10). Composite PK
(tmdb_id, month) gives month-boundary freshness without a TTL column.

Revision ID: 0028_reddit_cache
Revises: 0027_watch_log
Create Date: 2026-07-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

revision = "0028_reddit_cache"
down_revision = "0027_watch_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reddit_cache",
        sa.Column("tmdb_id", sa.Integer(), primary_key=True),
        sa.Column("month", sa.String(length=7), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("payload", JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("reddit_cache")
