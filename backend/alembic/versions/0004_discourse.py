"""Discourse layer: hot_takes, hot_take_reactions, polls, poll_votes, review_votes.

Revision ID: 0004_discourse
Revises: 0003_slates
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_discourse"
down_revision = "0003_slates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hot_takes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tmdb_id", sa.Integer(), nullable=True),
        sa.Column("body", sa.String(280), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_hot_takes_user_id", "hot_takes", ["user_id"])
    op.create_index("ix_hot_takes_tmdb_id", "hot_takes", ["tmdb_id"])
    op.create_index("ix_hot_takes_created_at", "hot_takes", ["created_at"])

    op.create_table(
        "hot_take_reactions",
        sa.Column(
            "hot_take_id",
            sa.String(),
            sa.ForeignKey("hot_takes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("kind", sa.String(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "polls",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "creator_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question", sa.String(), nullable=False),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("tmdb_id", sa.Integer(), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_polls_creator_id", "polls", ["creator_id"])

    op.create_table(
        "poll_votes",
        sa.Column(
            "poll_id",
            sa.String(),
            sa.ForeignKey("polls.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("option_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "review_votes",
        sa.Column(
            "review_id",
            sa.String(),
            sa.ForeignKey("reviews.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("review_votes")
    op.drop_table("poll_votes")
    op.drop_index("ix_polls_creator_id", table_name="polls")
    op.drop_table("polls")
    op.drop_table("hot_take_reactions")
    op.drop_index("ix_hot_takes_created_at", table_name="hot_takes")
    op.drop_index("ix_hot_takes_tmdb_id", table_name="hot_takes")
    op.drop_index("ix_hot_takes_user_id", table_name="hot_takes")
    op.drop_table("hot_takes")
