"""artists, artist_posts, amas, ama_questions, artist_follows.

Revision ID: 0007_artists
Revises: 0006_user_preferences
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007_artists"
down_revision = "0006_user_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "artists",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tmdb_person_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("headshot_url", sa.String(), nullable=True),
        sa.Column("roles", sa.JSON(), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "claimed_by_user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("awards", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_artists_tmdb_person_id", "artists", ["tmdb_person_id"], unique=True)

    op.create_table(
        "artist_posts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "artist_id",
            sa.String(),
            sa.ForeignKey("artists.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("media_url", sa.String(), nullable=True),
        sa.Column("linked_film_tmdb_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_artist_posts_artist_id", "artist_posts", ["artist_id"])

    op.create_table(
        "amas",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "artist_id",
            sa.String(),
            sa.ForeignKey("artists.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="scheduled"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_amas_artist_id", "amas", ["artist_id"])

    op.create_table(
        "ama_questions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "ama_id",
            sa.String(),
            sa.ForeignKey("amas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("answer_body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ama_questions_ama_id", "ama_questions", ["ama_id"])

    op.create_table(
        "artist_follows",
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "artist_id",
            sa.String(),
            sa.ForeignKey("artists.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("artist_follows")
    op.drop_index("ix_ama_questions_ama_id", table_name="ama_questions")
    op.drop_table("ama_questions")
    op.drop_index("ix_amas_artist_id", table_name="amas")
    op.drop_table("amas")
    op.drop_index("ix_artist_posts_artist_id", table_name="artist_posts")
    op.drop_table("artist_posts")
    op.drop_index("ix_artists_tmdb_person_id", table_name="artists")
    op.drop_table("artists")
