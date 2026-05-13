"""watch_parties + participants + reactions.

Revision ID: 0012_watch_parties
Revises: 0011_theatres
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0012_watch_parties"
down_revision = "0011_theatres"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "watch_parties",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "host_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tmdb_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="scheduled"),
        sa.Column("playback_seconds", sa.Float(), nullable=False, server_default="0"),
        sa.Column("playback_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_watch_parties_host_id", "watch_parties", ["host_id"])
    op.create_index("ix_watch_parties_tmdb_id", "watch_parties", ["tmdb_id"])
    op.create_index("ix_watch_parties_starts_at", "watch_parties", ["starts_at"])

    op.create_table(
        "watch_party_participants",
        sa.Column(
            "party_id",
            sa.String(),
            sa.ForeignKey("watch_parties.id", ondelete="CASCADE"),
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
        "watch_party_reactions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "party_id",
            sa.String(),
            sa.ForeignKey("watch_parties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("playback_seconds", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_watch_party_reactions_party_id", "watch_party_reactions", ["party_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_watch_party_reactions_party_id", table_name="watch_party_reactions"
    )
    op.drop_table("watch_party_reactions")
    op.drop_table("watch_party_participants")
    op.drop_index("ix_watch_parties_starts_at", table_name="watch_parties")
    op.drop_index("ix_watch_parties_tmdb_id", table_name="watch_parties")
    op.drop_index("ix_watch_parties_host_id", table_name="watch_parties")
    op.drop_table("watch_parties")
