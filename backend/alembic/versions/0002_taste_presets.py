"""Add taste_presets table for saved Taste Engine sentences.

Revision ID: 0002_taste_presets
Revises: 0001_onboarding_signals
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_taste_presets"
down_revision = "0001_onboarding_signals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "taste_presets",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_taste_presets_user_id", "taste_presets", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_taste_presets_user_id", table_name="taste_presets")
    op.drop_table("taste_presets")
