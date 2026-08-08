"""discovery_cache — cached Community Intelligence pool per seed film per month.

Backs the Community Intelligence Engine. Composite PK (seed_tmdb_id, month)
gives month-boundary freshness without a TTL column, mirroring reddit_cache.

Revision ID: 0030_discovery_cache
Revises: 0029_impression_features
Create Date: 2026-07-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

revision = "0030_discovery_cache"
down_revision = "0029_impression_features"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "discovery_cache",
        sa.Column("seed_tmdb_id", sa.Integer(), primary_key=True),
        sa.Column("month", sa.String(length=7), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("payload", JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("discovery_cache")
