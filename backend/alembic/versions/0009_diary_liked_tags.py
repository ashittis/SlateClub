"""Diary: a viewing can be liked, and can carry tags.

Both hang off the *viewing*, not the film, for the same reason `rating` does
(KASET.md §8): what you felt is a property of the watch, not a standing fact.
Loving a rewatch you were lukewarm on the first time is a real thing, and the
diary should be able to show both rows honestly.

`tags` is a plain text array rather than a join table. V1 treats them as
labels on an entry — displayed, not queried — so a table plus its two indexes
would be structure bought for a feature that does not exist yet. If Library
tag-filtering ships later, this column takes a GIN index and keeps working.

Both columns are NOT NULL with server defaults so every historical viewing gets
a coherent value (not liked, no tags) rather than a NULL that every read site
would then have to special-case.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_diary_liked_tags"
down_revision: Union[str, None] = "0008_watchlists_blends"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "diary_entries",
        sa.Column("liked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "diary_entries",
        sa.Column(
            "tags",
            sa.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::varchar[]"),
        ),
    )


def downgrade() -> None:
    op.drop_column("diary_entries", "tags")
    op.drop_column("diary_entries", "liked")
