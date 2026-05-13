"""theatres + showtimes.

Revision ID: 0011_theatres
Revises: 0010_festivals
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_theatres"
down_revision = "0010_festivals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "theatres",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("chain", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("region", sa.String(), nullable=False, server_default="IN"),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_theatres_city", "theatres", ["city"])

    op.create_table(
        "showtimes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("theatre_id", sa.String(), nullable=False),
        sa.Column("tmdb_id", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("booking_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_showtimes_theatre_id", "showtimes", ["theatre_id"])
    op.create_index("ix_showtimes_tmdb_id", "showtimes", ["tmdb_id"])
    op.create_index(
        "ix_showtimes_film_starts", "showtimes", ["tmdb_id", "starts_at"]
    )
    op.create_index(
        "ix_showtimes_theatre_starts", "showtimes", ["theatre_id", "starts_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_showtimes_theatre_starts", table_name="showtimes")
    op.drop_index("ix_showtimes_film_starts", table_name="showtimes")
    op.drop_index("ix_showtimes_tmdb_id", table_name="showtimes")
    op.drop_index("ix_showtimes_theatre_id", table_name="showtimes")
    op.drop_table("showtimes")
    op.drop_index("ix_theatres_city", table_name="theatres")
    op.drop_table("theatres")
