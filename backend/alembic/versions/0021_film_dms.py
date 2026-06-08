"""film_dms — film recommendations sent to a user's inbox.

Revision ID: 0021_film_dms
Revises: 0020_match_cuts
Create Date: 2026-06-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_film_dms"
down_revision = "0020_match_cuts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "film_dms",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("sender_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("movie_id", sa.String(), sa.ForeignKey("movies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reaction", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_film_dms_recipient", "film_dms", ["recipient_id"])
    op.create_index("ix_film_dms_sender", "film_dms", ["sender_id"])


def downgrade() -> None:
    op.drop_index("ix_film_dms_sender", table_name="film_dms")
    op.drop_index("ix_film_dms_recipient", table_name="film_dms")
    op.drop_table("film_dms")
