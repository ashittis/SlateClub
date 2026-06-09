"""shelf notes + currently_watching + dnf_entries.

Adds Shelf Notes columns to watchlist_items and two new lifecycle tables
(currently_watching, dnf_entries). watch_history is intentionally untouched
so existing "watched" semantics stay stable.

Revision ID: 0023_shelf_notes_watching_dnf
Revises: 0022_similar_cache
Create Date: 2026-06-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023_shelf_notes_watching_dnf"
down_revision = "0022_similar_cache"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Shelf Notes — why the user saved the film.
    op.add_column("watchlist_items", sa.Column("reasonType", sa.String(), nullable=True))
    op.add_column("watchlist_items", sa.Column("reasonReference", sa.String(), nullable=True))
    op.add_column("watchlist_items", sa.Column("note", sa.Text(), nullable=True))

    op.create_table(
        "currently_watching",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "userId",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "movieId",
            sa.String(),
            sa.ForeignKey("movies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("progressPct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("startedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("userId", "movieId"),
    )

    op.create_table(
        "dnf_entries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "userId",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "movieId",
            sa.String(),
            sa.ForeignKey("movies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("stoppedAt", sa.String(), nullable=True),
        sa.Column("progressPct", sa.Float(), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("userId", "movieId"),
    )


def downgrade() -> None:
    op.drop_table("dnf_entries")
    op.drop_table("currently_watching")
    op.drop_column("watchlist_items", "note")
    op.drop_column("watchlist_items", "reasonReference")
    op.drop_column("watchlist_items", "reasonType")
