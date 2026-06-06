"""community posts, replies, upvotes.

Revision ID: 0015_community_posts
Revises: 0014_chapters
Create Date: 2026-06-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0015_community_posts"
down_revision = "0014_chapters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "posts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("post_type", sa.String(), nullable=False, server_default="text"),
        sa.Column("tmdb_id", sa.Integer(), nullable=True),
        sa.Column("reply_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_posts_user_id", "posts", ["user_id"])
    op.create_index("ix_posts_tmdb_id", "posts", ["tmdb_id"])
    op.create_index("ix_posts_created_at", "posts", ["created_at"])

    op.create_table(
        "post_replies",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "post_id",
            sa.String(),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_post_replies_post_id", "post_replies", ["post_id"])
    op.create_index("ix_post_replies_created_at", "post_replies", ["created_at"])

    op.create_table(
        "post_upvotes",
        sa.Column(
            "post_id",
            sa.String(),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("post_upvotes")
    op.drop_index("ix_post_replies_created_at", table_name="post_replies")
    op.drop_index("ix_post_replies_post_id", table_name="post_replies")
    op.drop_table("post_replies")
    op.drop_index("ix_posts_created_at", table_name="posts")
    op.drop_index("ix_posts_tmdb_id", table_name="posts")
    op.drop_index("ix_posts_user_id", table_name="posts")
    op.drop_table("posts")
