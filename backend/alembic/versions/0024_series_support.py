"""TV series support — media_type discriminator + season/episode ratings.

- movies: add mediaType ('movie'|'tv') + numberOfSeasons; swap the single-column
  unique on tmdbId for a composite unique (tmdbId, mediaType) since TMDB movie
  and TV ids collide.
- reviews: add seasonNumber (0 = whole title) and key uniqueness on it so a user
  can review the whole series AND individual seasons.
- new tables: season_ratings, episode_ratings, episode_reactions.

Revision ID: 0024_series_support
Revises: 0023_shelf_notes_watching_dnf
Create Date: 2026-06-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0024_series_support"
down_revision = "0023_shelf_notes_watching_dnf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # movies: discriminator + composite uniqueness.
    op.add_column(
        "movies",
        sa.Column("mediaType", sa.String(), nullable=False, server_default="movie"),
    )
    op.add_column("movies", sa.Column("numberOfSeasons", sa.Integer(), nullable=True))
    op.drop_index("ix_movies_tmdbId", table_name="movies")
    op.create_index("ix_movies_tmdbId", "movies", ["tmdbId"])
    op.create_index("ix_movies_mediaType", "movies", ["mediaType"])
    op.create_unique_constraint(
        "uq_movies_tmdbId_mediaType", "movies", ["tmdbId", "mediaType"]
    )

    # reviews: per-season reviews.
    op.add_column(
        "reviews",
        sa.Column("seasonNumber", sa.Integer(), nullable=False, server_default="0"),
    )
    op.drop_constraint("reviews_user_id_movie_id_key", "reviews", type_="unique")
    op.create_unique_constraint(
        "uq_reviews_user_movie_season",
        "reviews",
        ["user_id", "movie_id", "seasonNumber"],
    )

    op.create_table(
        "season_ratings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("userId", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("movieId", sa.String(), sa.ForeignKey("movies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seasonNumber", sa.Integer(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("userId", "movieId", "seasonNumber"),
    )
    op.create_table(
        "episode_ratings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("userId", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("movieId", sa.String(), sa.ForeignKey("movies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seasonNumber", sa.Integer(), nullable=False),
        sa.Column("episodeNumber", sa.Integer(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("userId", "movieId", "seasonNumber", "episodeNumber"),
    )
    op.create_table(
        "episode_reactions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("userId", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("movieId", sa.String(), sa.ForeignKey("movies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seasonNumber", sa.Integer(), nullable=False),
        sa.Column("episodeNumber", sa.Integer(), nullable=False),
        sa.Column("reaction", sa.String(), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("userId", "movieId", "seasonNumber", "episodeNumber"),
    )


def downgrade() -> None:
    op.drop_table("episode_reactions")
    op.drop_table("episode_ratings")
    op.drop_table("season_ratings")

    op.drop_constraint("uq_reviews_user_movie_season", "reviews", type_="unique")
    op.create_unique_constraint(
        "reviews_user_id_movie_id_key", "reviews", ["user_id", "movie_id"]
    )
    op.drop_column("reviews", "seasonNumber")

    op.drop_constraint("uq_movies_tmdbId_mediaType", "movies", type_="unique")
    op.drop_index("ix_movies_mediaType", table_name="movies")
    op.drop_index("ix_movies_tmdbId", table_name="movies")
    op.create_index("ix_movies_tmdbId", "movies", ["tmdbId"], unique=True)
    op.drop_column("movies", "numberOfSeasons")
    op.drop_column("movies", "mediaType")
