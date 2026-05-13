"""festivals + festival_posts.

Revision ID: 0010_festivals
Revises: 0009_cultural_contexts
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_festivals"
down_revision = "0009_cultural_contexts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "festivals",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("banner_url", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_festivals_slug", "festivals", ["slug"], unique=True)
    op.create_index("ix_festivals_starts_at", "festivals", ["starts_at"])

    op.create_table(
        "festival_posts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "festival_id",
            sa.String(),
            sa.ForeignKey("festivals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("tmdb_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_festival_posts_festival_id", "festival_posts", ["festival_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_festival_posts_festival_id", table_name="festival_posts")
    op.drop_table("festival_posts")
    op.drop_index("ix_festivals_starts_at", table_name="festivals")
    op.drop_index("ix_festivals_slug", table_name="festivals")
    op.drop_table("festivals")
