"""movie_identity columns — Gemini-extracted MovieIdentity + embedding.

Revision ID: 0016_movie_identity
Revises: 0015_impressions
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0016_movie_identity"
down_revision = "0015_impressions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "movies",
        sa.Column("identityJson", postgresql.JSON(), nullable=True),
    )
    op.add_column(
        "movies",
        sa.Column("identityEmbedding", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "movies",
        sa.Column("identityUpdatedAt", sa.DateTime(timezone=True), nullable=True),
    )
    # Partial index to make "movies needing extraction" cheap to query.
    op.create_index(
        "ix_movies_identity_pending",
        "movies",
        ["id"],
        postgresql_where=sa.text('"identityJson" IS NULL'),
    )


def downgrade() -> None:
    op.drop_index("ix_movies_identity_pending", table_name="movies")
    op.drop_column("movies", "identityUpdatedAt")
    op.drop_column("movies", "identityEmbedding")
    op.drop_column("movies", "identityJson")
