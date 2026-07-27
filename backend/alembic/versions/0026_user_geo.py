"""IP-derived location on users.

Adds city/region/country + geoUpdatedAt so the home "Trending in your city"
rail can aggregate recent activity by the caller's IP-resolved city.

Revision ID: 0026_user_geo
Revises: 0025_slate_media_and_likes
Create Date: 2026-07-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0026_user_geo"
down_revision = "0025_slate_media_and_likes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("city", sa.String(), nullable=True))
    op.add_column("users", sa.Column("region", sa.String(), nullable=True))
    op.add_column("users", sa.Column("country", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("geoUpdatedAt", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_city", "users", ["city"])


def downgrade() -> None:
    op.drop_index("ix_users_city", table_name="users")
    op.drop_column("users", "geoUpdatedAt")
    op.drop_column("users", "country")
    op.drop_column("users", "region")
    op.drop_column("users", "city")
