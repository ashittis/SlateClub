"""orbit_requests — friend (orbit) request/accept system.

Revision ID: 0019_orbit_requests
Revises: 0018_impression_source
Create Date: 2026-06-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0019_orbit_requests"
down_revision = "0018_impression_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "orbit_requests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("from_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("from_id", "to_id", name="uq_orbit_from_to"),
    )
    op.create_index("ix_orbit_to", "orbit_requests", ["to_id"])
    op.create_index("ix_orbit_from", "orbit_requests", ["from_id"])


def downgrade() -> None:
    op.drop_index("ix_orbit_from", table_name="orbit_requests")
    op.drop_index("ix_orbit_to", table_name="orbit_requests")
    op.drop_table("orbit_requests")
