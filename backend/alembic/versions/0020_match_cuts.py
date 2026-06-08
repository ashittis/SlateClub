"""match_cuts + match_cut_members — saved/invitable blends.

Revision ID: 0020_match_cuts
Revises: 0019_orbit_requests
Create Date: 2026-06-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020_match_cuts"
down_revision = "0019_orbit_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "match_cuts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("creator_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("invite_token", sa.String(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_match_cuts_creator", "match_cuts", ["creator_id"])
    op.create_table(
        "match_cut_members",
        sa.Column("cut_id", sa.String(), sa.ForeignKey("match_cuts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("match_cut_members")
    op.drop_index("ix_match_cuts_creator", table_name="match_cuts")
    op.drop_table("match_cuts")
