"""impressions.features_json — capture the exact ranker feature row per impression.

Lets the eval harness (Task 1) train/evaluate on real captured features instead
of reconstructing them. Nullable: existing rows keep NULL and fall back to
point-in-time reconstruction.

Revision ID: 0029_impression_features
Revises: 0028_reddit_cache
Create Date: 2026-07-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

revision = "0029_impression_features"
down_revision = "0028_reddit_cache"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("impressions", sa.Column("features_json", JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("impressions", "features_json")
