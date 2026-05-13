"""Add onboarding_signals table for the 8-step Tune Your Taste flow.

NOTE: this is the first migration in `versions/`. The remaining tables
(users, movies, ratings, reviews, follows, etc.) are still created at
app startup by `Base.metadata.create_all()` — see
`backend/app/main.py`. A future migration should snapshot the rest of
the schema as a proper baseline, generated via:

    alembic revision --autogenerate -m "baseline"

Until then, this file only adds the new table introduced by Phase 1.2.

Revision ID: 0001_onboarding_signals
Revises:
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision = "0001_onboarding_signals"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "onboarding_signals",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("poster_picks", sa.JSON(), nullable=True),
        sa.Column("mood_pacing", sa.Float(), nullable=True),
        sa.Column("mood_tone", sa.Float(), nullable=True),
        sa.Column("mood_realism", sa.Float(), nullable=True),
        sa.Column("platforms", sa.JSON(), nullable=True),
        sa.Column("prefers_theatres", sa.Boolean(), nullable=True),
        sa.Column("origin_film_tmdb_id", sa.Integer(), nullable=True),
        sa.Column("welcomed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ready_shown_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_onboarding_signals_user_id",
        "onboarding_signals",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_onboarding_signals_user_id", table_name="onboarding_signals")
    op.drop_table("onboarding_signals")
