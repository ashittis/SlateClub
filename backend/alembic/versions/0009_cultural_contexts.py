"""cultural_contexts table.

Revision ID: 0009_cultural_contexts
Revises: 0008_releases
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009_cultural_contexts"
down_revision = "0008_releases"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cultural_contexts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tmdb_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("headline", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cultural_contexts_tmdb_id", "cultural_contexts", ["tmdb_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_cultural_contexts_tmdb_id", table_name="cultural_contexts")
    op.drop_table("cultural_contexts")
