"""Diary: watch types, theatre visits, and the review link.

`watch_log` becomes `diary_entries`, its camelCase columns become snake_case,
and it gains the fields the product actually needs: how you watched it, where,
and which review came out of it.

Written by hand as a **rename**, not a drop-and-create. Autogenerate proposed
dropping `watch_log` and creating `diary_entries`, which would silently delete
every viewing ever logged. That is precisely the thing this table exists to
prevent, so the migration preserves rows instead.

Two conversions worth noting:
  - `watchedAt` (timestamptz) → `watched_on` (date). A viewing belongs to a day,
    not an instant; storing a timestamp meant a late-night log could land on
    tomorrow's date. Existing values are cast at their stored UTC date.
  - `atTheatre` (bool) → `watch_type` (text). True becomes 'theatre'; False
    becomes 'other' rather than 'streaming', because the old boolean genuinely
    did not record how the film was watched and guessing would invent data.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_diary_watch_types"
down_revision: Union[str, None] = "0003_films_only"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("watch_log", "diary_entries")

    op.alter_column("diary_entries", "userId", new_column_name="user_id")
    op.alter_column("diary_entries", "movieId", new_column_name="movie_id")
    op.alter_column("diary_entries", "isRewatch", new_column_name="is_rewatch")
    op.alter_column("diary_entries", "reviewId", new_column_name="review_id")
    op.alter_column("diary_entries", "createdAt", new_column_name="created_at")

    # timestamptz → date, keeping the day each viewing was recorded against.
    #
    # The cast is pinned to UTC. A bare `"watchedAt"::date` resolves in the
    # session timezone, so a 22:30 UTC viewing migrated on a machine set to
    # IST would silently land on the *following* day — the same class of
    # off-by-one this column change exists to eliminate.
    op.alter_column(
        "diary_entries",
        "watchedAt",
        new_column_name="watched_on",
        type_=sa.Date(),
        postgresql_using='("watchedAt" AT TIME ZONE \'UTC\')::date',
        existing_nullable=False,
    )

    op.add_column(
        "diary_entries",
        sa.Column("watch_type", sa.String(), nullable=False, server_default="other"),
    )
    op.execute(
        "UPDATE diary_entries SET watch_type = 'theatre' WHERE \"atTheatre\" IS TRUE"
    )
    op.drop_column("diary_entries", "atTheatre")

    op.add_column("diary_entries", sa.Column("theatre_name", sa.String(), nullable=True))
    op.add_column("diary_entries", sa.Column("theatre_city", sa.String(), nullable=True))
    op.add_column("diary_entries", sa.Column("theatre_format", sa.String(), nullable=True))

    op.drop_index("ix_watchlog_user_watched", table_name="diary_entries")
    op.drop_index("ix_watchlog_user_movie", table_name="diary_entries")
    op.create_index("ix_diary_user_watched", "diary_entries", ["user_id", "watched_on"])
    op.create_index("ix_diary_user_movie", "diary_entries", ["user_id", "movie_id"])

    # The other half of the link: a review knows which viewing produced it.
    # SET NULL both ways — neither object should destroy the other.
    op.add_column("reviews", sa.Column("diary_entry_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_reviews_diary_entry",
        "reviews",
        "diary_entries",
        ["diary_entry_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_reviews_diary_entry", "reviews", type_="foreignkey")
    op.drop_column("reviews", "diary_entry_id")

    op.drop_index("ix_diary_user_movie", table_name="diary_entries")
    op.drop_index("ix_diary_user_watched", table_name="diary_entries")
    op.create_index("ix_watchlog_user_movie", "diary_entries", ["user_id", "movie_id"])
    op.create_index("ix_watchlog_user_watched", "diary_entries", ["user_id", "watched_on"])

    op.add_column(
        "diary_entries",
        sa.Column("atTheatre", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE diary_entries SET \"atTheatre\" = TRUE WHERE watch_type = 'theatre'")
    op.drop_column("diary_entries", "theatre_format")
    op.drop_column("diary_entries", "theatre_city")
    op.drop_column("diary_entries", "theatre_name")
    op.drop_column("diary_entries", "watch_type")

    op.alter_column(
        "diary_entries",
        "watched_on",
        new_column_name="watchedAt",
        type_=sa.DateTime(timezone=True),
        postgresql_using="watched_on::timestamptz",
        existing_nullable=False,
    )
    op.alter_column("diary_entries", "created_at", new_column_name="createdAt")
    op.alter_column("diary_entries", "review_id", new_column_name="reviewId")
    op.alter_column("diary_entries", "is_rewatch", new_column_name="isRewatch")
    op.alter_column("diary_entries", "movie_id", new_column_name="movieId")
    op.alter_column("diary_entries", "user_id", new_column_name="userId")

    op.rename_table("diary_entries", "watch_log")
