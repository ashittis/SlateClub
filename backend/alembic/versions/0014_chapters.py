"""chapters + members + events.

Revision ID: 0014_chapters
Revises: 0013_taste_circles
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0014_chapters"
down_revision = "0013_taste_circles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chapters",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("region", sa.String(), nullable=False, server_default="IN"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chapters_slug", "chapters", ["slug"], unique=True)
    op.create_index("ix_chapters_city", "chapters", ["city"])

    op.create_table(
        "chapter_members",
        sa.Column(
            "chapter_id",
            sa.String(),
            sa.ForeignKey("chapters.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "chapter_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "chapter_id",
            sa.String(),
            sa.ForeignKey("chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("venue", sa.String(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tmdb_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_by_user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_chapter_events_chapter_id", "chapter_events", ["chapter_id"]
    )
    op.create_index(
        "ix_chapter_events_starts_at", "chapter_events", ["starts_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_chapter_events_starts_at", table_name="chapter_events")
    op.drop_index("ix_chapter_events_chapter_id", table_name="chapter_events")
    op.drop_table("chapter_events")
    op.drop_table("chapter_members")
    op.drop_index("ix_chapters_city", table_name="chapters")
    op.drop_index("ix_chapters_slug", table_name="chapters")
    op.drop_table("chapters")
