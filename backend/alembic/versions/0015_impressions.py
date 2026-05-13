"""impressions table — log every recommendation shown.

Revision ID: 0015_impressions
Revises: 0014_chapters
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0015_impressions"
down_revision = "0014_chapters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "impressions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("movie_id", sa.String(), nullable=False),
        sa.Column("surface", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("rank_score", sa.Float(), nullable=True),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("shown_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_impressions_user_shown", "impressions", ["user_id", "shown_at"]
    )
    op.create_index(
        "ix_impressions_movie_user", "impressions", ["movie_id", "user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_impressions_movie_user", table_name="impressions")
    op.drop_index("ix_impressions_user_shown", table_name="impressions")
    op.drop_table("impressions")
