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
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_taste_state (
            user_id VARCHAR NOT NULL PRIMARY KEY,
            taste_statement TEXT,
            taste_embedding BYTEA,
            tone_axes JSON,
            last_drift_score FLOAT,
            last_computed_at TIMESTAMP WITH TIME ZONE,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)


def downgrade() -> None:
    op.drop_table("user_taste_state")
