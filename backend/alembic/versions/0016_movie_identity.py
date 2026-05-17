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
    # Use raw SQL with IF NOT EXISTS so re-running after a partial rollback is safe.
    op.execute('ALTER TABLE movies ADD COLUMN IF NOT EXISTS "identityJson" JSON')
    op.execute('ALTER TABLE movies ADD COLUMN IF NOT EXISTS "identityEmbedding" BYTEA')
    op.execute('ALTER TABLE movies ADD COLUMN IF NOT EXISTS "identityUpdatedAt" TIMESTAMP WITH TIME ZONE')
    op.execute('CREATE INDEX IF NOT EXISTS ix_movies_identity_pending ON movies (id) WHERE "identityJson" IS NULL')


def downgrade() -> None:
    op.drop_index("ix_movies_identity_pending", table_name="movies")
    op.drop_column("movies", "identityUpdatedAt")
    op.drop_column("movies", "identityEmbedding")
    op.drop_column("movies", "identityJson")
