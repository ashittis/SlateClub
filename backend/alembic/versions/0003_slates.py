"""Slates: collections + films + collaborators + saves + room messages.

Revision ID: 0003_slates
Revises: 0002_taste_presets
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_slates"
down_revision = "0002_taste_presets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "slates",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "creator_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_layout", sa.String(), nullable=False, server_default="mosaic_4"),
        sa.Column("visibility", sa.String(), nullable=False, server_default="public"),
        sa.Column("is_collaborative", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_slates_creator_id", "slates", ["creator_id"])

    op.create_table(
        "slate_films",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "slate_id",
            sa.String(),
            sa.ForeignKey("slates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tmdb_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "added_by_user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("slate_id", "tmdb_id"),
    )
    op.create_index("ix_slate_films_slate_id", "slate_films", ["slate_id"])

    op.create_table(
        "slate_collaborators",
        sa.Column(
            "slate_id",
            sa.String(),
            sa.ForeignKey("slates.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(), nullable=False, server_default="contributor"),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "slate_saves",
        sa.Column(
            "slate_id",
            sa.String(),
            sa.ForeignKey("slates.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "slate_room_messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "slate_id",
            sa.String(),
            sa.ForeignKey("slates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "parent_id",
            sa.String(),
            sa.ForeignKey("slate_room_messages.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_slate_room_messages_slate_id", "slate_room_messages", ["slate_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_slate_room_messages_slate_id", table_name="slate_room_messages")
    op.drop_table("slate_room_messages")
    op.drop_table("slate_saves")
    op.drop_table("slate_collaborators")
    op.drop_index("ix_slate_films_slate_id", table_name="slate_films")
    op.drop_table("slate_films")
    op.drop_index("ix_slates_creator_id", table_name="slates")
    op.drop_table("slates")
