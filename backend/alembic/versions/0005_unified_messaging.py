"""Unify messaging: one conversation model, films as messages.

SlateClub had two DM systems. `chat_conversations`/`chat_messages` were real
threads; `film_dms` were one-shot "recommend this film" objects with a fixed
reaction set and no reply. Kaset has one model where a shared film *is* a
message, so a recommendation can be discussed.

Hand-written as a **rename + merge**, not drop-and-create. Autogenerate proposed
dropping all three tables and building two new ones, which would delete every
message and every film anyone had ever sent. Instead:

  chat_conversations → conversations   (user1/user2 → user_a/user_b)
  chat_messages      → messages        (+ shared_movie_id, read_at)
  film_dms           → merged in       (each becomes a message in the right
                                        thread, creating it if needed)

`film_dms.reaction` has no home in the new model — the fixed reaction set is
gone — so it is folded into the message body rather than dropped silently.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_unified_messaging"
down_revision: Union[str, None] = "0004_diary_watch_types"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Threads ──────────────────────────────────────────────────────────────
    op.rename_table("chat_conversations", "conversations")
    op.alter_column("conversations", "user1_id", new_column_name="user_a_id")
    op.alter_column("conversations", "user2_id", new_column_name="user_b_id")
    op.alter_column(
        "conversations", "last_preview", type_=sa.String(length=140), existing_nullable=True
    )

    op.drop_index("ix_chat_conversations_user1_id", table_name="conversations")
    op.drop_index("ix_chat_conversations_user2_id", table_name="conversations")
    op.create_index("ix_conversations_user_a_id", "conversations", ["user_a_id"])
    op.create_index("ix_conversations_user_b_id", "conversations", ["user_b_id"])
    op.create_index("ix_conversations_recent", "conversations", ["last_message_at"])

    # The old table left pair-ordering to the caller, so its unique constraint
    # was decorative — (A,B) and (B,A) could both exist. Normalise before the
    # new constraint is relied upon.
    op.execute(
        """
        UPDATE conversations
           SET user_a_id = LEAST(user_a_id, user_b_id),
               user_b_id = GREATEST(user_a_id, user_b_id)
         WHERE user_a_id > user_b_id
        """
    )

    # ── Messages ─────────────────────────────────────────────────────────────
    op.rename_table("chat_messages", "messages")
    op.alter_column("messages", "body", existing_type=sa.Text(), nullable=True)
    op.add_column("messages", sa.Column("shared_movie_id", sa.String(), nullable=True))
    op.add_column(
        "messages", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_messages_shared_movie",
        "messages",
        "movies",
        ["shared_movie_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_index("ix_chat_messages_conversation_id", table_name="messages")
    op.drop_index("ix_chat_messages_sender_id", table_name="messages")
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_thread", "messages", ["conversation_id", "created_at"])

    # ── Fold film_dms into the thread model ──────────────────────────────────
    # A thread for every film-DM pair that doesn't already have one.
    op.execute(
        """
        INSERT INTO conversations (id, user_a_id, user_b_id, created_at)
        SELECT gen_random_uuid()::text,
               LEAST(d.sender_id, d.recipient_id),
               GREATEST(d.sender_id, d.recipient_id),
               MIN(d.created_at)
          FROM film_dms d
         GROUP BY LEAST(d.sender_id, d.recipient_id), GREATEST(d.sender_id, d.recipient_id)
            ON CONFLICT (user_a_id, user_b_id) DO NOTHING
        """
    )

    # Each film DM becomes a message carrying the film. The old reaction was a
    # fixed-vocabulary reply with nowhere to live now, so it is preserved as text.
    op.execute(
        """
        INSERT INTO messages (id, conversation_id, sender_id, body, shared_movie_id, read_at, created_at)
        SELECT gen_random_uuid()::text,
               c.id,
               d.sender_id,
               d.reaction,
               d.movie_id,
               d.read_at,
               d.created_at
          FROM film_dms d
          JOIN conversations c
            ON c.user_a_id = LEAST(d.sender_id, d.recipient_id)
           AND c.user_b_id = GREATEST(d.sender_id, d.recipient_id)
        """
    )

    # Refresh thread previews so the inbox reflects the merged history.
    op.execute(
        """
        UPDATE conversations c
           SET last_message_at = m.max_created,
               last_preview    = COALESCE(c.last_preview, 'Shared a film')
          FROM (
                SELECT conversation_id, MAX(created_at) AS max_created
                  FROM messages GROUP BY conversation_id
               ) m
         WHERE m.conversation_id = c.id
           AND (c.last_message_at IS NULL OR m.max_created > c.last_message_at)
        """
    )

    op.drop_index("ix_film_dms_recipient_id", table_name="film_dms")
    op.drop_index("ix_film_dms_sender_id", table_name="film_dms")
    op.drop_table("film_dms")


def downgrade() -> None:
    # film_dms cannot be reconstructed — which messages were film DMs is no
    # longer distinguishable from films shared in conversation. Recreate the
    # table empty rather than pretending to restore it.
    op.create_table(
        "film_dms",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("sender_id", sa.String(), nullable=False),
        sa.Column("recipient_id", sa.String(), nullable=False),
        sa.Column("movie_id", sa.String(), nullable=False),
        sa.Column("reaction", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["movie_id"], ["movies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_film_dms_sender_id", "film_dms", ["sender_id"])
    op.create_index("ix_film_dms_recipient_id", "film_dms", ["recipient_id"])

    op.drop_index("ix_messages_thread", table_name="messages")
    op.drop_index("ix_messages_sender_id", table_name="messages")
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.create_index("ix_chat_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_chat_messages_conversation_id", "messages", ["conversation_id"])

    op.drop_constraint("fk_messages_shared_movie", "messages", type_="foreignkey")
    op.drop_column("messages", "read_at")
    op.drop_column("messages", "shared_movie_id")
    op.execute("UPDATE messages SET body = '' WHERE body IS NULL")
    op.alter_column("messages", "body", existing_type=sa.Text(), nullable=False)
    op.rename_table("messages", "chat_messages")

    op.drop_index("ix_conversations_recent", table_name="conversations")
    op.drop_index("ix_conversations_user_b_id", table_name="conversations")
    op.drop_index("ix_conversations_user_a_id", table_name="conversations")
    op.create_index("ix_chat_conversations_user2_id", "conversations", ["user_b_id"])
    op.create_index("ix_chat_conversations_user1_id", "conversations", ["user_a_id"])

    op.alter_column(
        "conversations", "last_preview", type_=sa.String(length=120), existing_nullable=True
    )
    op.alter_column("conversations", "user_b_id", new_column_name="user2_id")
    op.alter_column("conversations", "user_a_id", new_column_name="user1_id")
    op.rename_table("conversations", "chat_conversations")
