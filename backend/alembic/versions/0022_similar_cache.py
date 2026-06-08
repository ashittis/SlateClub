"""similar_cache — persisted 'movies like X' payloads to skip the LLM.

Revision ID: 0022_similar_cache
Revises: 0021_film_dms
Create Date: 2026-06-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022_similar_cache"
down_revision = "0021_film_dms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "similar_cache",
        sa.Column("seed_tmdb_id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("similar_cache")
