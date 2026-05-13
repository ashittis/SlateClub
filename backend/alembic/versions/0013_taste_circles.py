"""taste_circles + members + messages.

Revision ID: 0013_taste_circles
Revises: 0012_watch_parties
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013_taste_circles"
down_revision = "0012_watch_parties"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "taste_circles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "creator_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_taste_circles_creator_id", "taste_circles", ["creator_id"])

    op.create_table(
        "taste_circle_members",
        sa.Column(
            "circle_id",
            sa.String(),
            sa.ForeignKey("taste_circles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "taste_circle_messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "circle_id",
            sa.String(),
            sa.ForeignKey("taste_circles.id", ondelete="CASCADE"),
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
        "ix_taste_circle_messages_circle_id",
        "taste_circle_messages",
        ["circle_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_taste_circle_messages_circle_id", table_name="taste_circle_messages"
    )
    op.drop_table("taste_circle_messages")
    op.drop_table("taste_circle_members")
    op.drop_index("ix_taste_circles_creator_id", table_name="taste_circles")
    op.drop_table("taste_circles")
