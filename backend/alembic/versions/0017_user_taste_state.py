"""user_taste_state — LLM-derived taste snapshot per user.

Revision ID: 0017_user_taste_state
Revises: 0016_movie_identity
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0017_user_taste_state"
down_revision = "0016_movie_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_taste_state",
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("taste_statement", sa.Text(), nullable=True),
        sa.Column("taste_embedding", sa.LargeBinary(), nullable=True),
        sa.Column("tone_axes", sa.JSON(), nullable=True),
        sa.Column("last_drift_score", sa.Float(), nullable=True),
        sa.Column("last_computed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_taste_state")
