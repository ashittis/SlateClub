"""user_preferences table.

Revision ID: 0006_user_preferences
Revises: 0005_notifications
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_user_preferences"
down_revision = "0005_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("notif_opt_out", sa.JSON(), nullable=True),
        sa.Column(
            "profile_visibility",
            sa.String(),
            nullable=False,
            server_default="public",
        ),
        sa.Column(
            "twin_matching_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
