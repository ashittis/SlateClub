"""
Free-text DM threads between two users (Reddit/iMessage style).
Each conversation is keyed on the canonical (min_id, max_id) pair so there
can never be duplicate threads for the same pair.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.features.community.models.chat import ChatConversation, ChatMessage
from app.shared.models.user import User

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── Schemas ────────────────────────────────────────────────────

class SendBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)


# ── Helpers ────────────────────────────────────────────────────

def _canonical(a: str, b: str) -> tuple[str, str]:
    """Return (smaller_id, larger_id) so the pair is always stored the same way."""
    return (a, b) if a < b else (b, a)


def _user_dict(u: User) -> dict:
    return {"id": u.id, "name": u.name, "username": u.username, "avatarUrl": u.avatar_url}


async def _get_or_create_conversation(
    me_id: str, other_id: str, db: AsyncSession
) -> ChatConversation:
    u1, u2 = _canonical(me_id, other_id)
    row = (
        await db.execute(
            select(ChatConversation).where(
                ChatConversation.user1_id == u1, ChatConversation.user2_id == u2
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = ChatConversation(user1_id=u1, user2_id=u2)
        db.add(row)
        await db.flush()
    return row


# ── Routes ─────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all conversations for the current user, newest first."""
    rows = (
        await db.execute(
            select(ChatConversation)
            .where(
                or_(ChatConversation.user1_id == me.id, ChatConversation.user2_id == me.id)
            )
            .order_by(ChatConversation.last_message_at.desc().nullslast())
        )
    ).scalars().all()

    result = []
    for conv in rows:
        other_id = conv.user2_id if conv.user1_id == me.id else conv.user1_id
        other = (await db.execute(select(User).where(User.id == other_id))).scalar_one_or_none()
        if other is None:
            continue
        result.append({
            "id": conv.id,
            "other": _user_dict(other),
            "lastPreview": conv.last_preview,
            "lastMessageAt": conv.last_message_at.isoformat() if conv.last_message_at else None,
        })

    return {"items": result}


@router.post("/conversations/with/{other_user_id}")
async def open_or_create(
    other_user_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Open (or create) a DM thread with another user. Returns the conversation id."""
    if other_user_id == me.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    other = (await db.execute(select(User).where(User.id == other_user_id))).scalar_one_or_none()
    if other is None:
        raise HTTPException(status_code=404, detail="User not found")

    conv = await _get_or_create_conversation(me.id, other_user_id, db)
    return {"conversationId": conv.id, "other": _user_dict(other)}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
    before: str | None = Query(None),
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List messages in a thread (newest first for pagination, caller reverses for display)."""
    conv = (
        await db.execute(
            select(ChatConversation).where(
                ChatConversation.id == conversation_id,
                or_(ChatConversation.user1_id == me.id, ChatConversation.user2_id == me.id),
            )
        )
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    q = (
        select(ChatMessage, User)
        .join(User, User.id == ChatMessage.sender_id)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    if before:
        cutoff = datetime.fromisoformat(before)
        q = q.where(ChatMessage.created_at < cutoff)

    rows = (await db.execute(q)).all()

    other_id = conv.user2_id if conv.user1_id == me.id else conv.user1_id
    other = (await db.execute(select(User).where(User.id == other_id))).scalar_one_or_none()

    messages = [
        {
            "id": msg.id,
            "body": msg.body,
            "sender": _user_dict(sender),
            "mine": sender.id == me.id,
            "createdAt": msg.created_at.isoformat(),
        }
        for msg, sender in reversed(rows)
    ]

    return {
        "messages": messages,
        "other": _user_dict(other) if other else None,
        "conversationId": conversation_id,
    }


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message in an existing thread."""
    conv = (
        await db.execute(
            select(ChatConversation).where(
                ChatConversation.id == conversation_id,
                or_(ChatConversation.user1_id == me.id, ChatConversation.user2_id == me.id),
            )
        )
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg = ChatMessage(
        conversation_id=conversation_id,
        sender_id=me.id,
        body=body.body.strip(),
    )
    db.add(msg)
    now = datetime.now(timezone.utc)
    conv.last_message_at = now
    conv.last_preview = body.body.strip()[:120]
    await db.flush()

    return {
        "id": msg.id,
        "body": msg.body,
        "sender": _user_dict(me),
        "mine": True,
        "createdAt": msg.created_at.isoformat(),
    }
