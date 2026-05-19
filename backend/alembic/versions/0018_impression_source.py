"""impressions.source — track which candidate pool produced each impression.

Revision ID: 0018_impression_source
Revises: 0017_user_taste_state
Create Date: 2026-05-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0018_impression_source"
down_revision = "0017_user_taste_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "impressions",
        sa.Column("source", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("impressions", "source")
