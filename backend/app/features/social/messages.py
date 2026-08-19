"""Direct messages, with films as first-class content.

One conversation model. Sharing a film is a message with `shared_movie_id`, so
it lands in the thread in order and can be replied to — rather than sitting in a
separate inbox the way SlateClub's `film_dms` did.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.messaging import Conversation, Message
from app.shared.models.movie import Movie
from app.shared.models.user import User
from app.shared.services.films import film_payload, get_or_fetch_film
from app.shared.services.notify import notify

router = APIRouter(prefix="/api/messages", tags=["messages"])


class SendBody(BaseModel):
    body: str | None = None
    #: Share a film by TMDB id — resolved and cached like anywhere else.
    tmdb_id: int | None = Field(None, alias="tmdbId")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _needs_content(self):
        if not (self.body and self.body.strip()) and self.tmdb_id is None:
            raise ValueError("A message needs text, a film, or both")
        return self


def _preview(body: str | None, film: Movie | None) -> str:
    if film and not body:
        return f"Shared {film.title}"
    if film and body:
        return f"{film.title} — {body}"[:140]
    return (body or "")[:140]


async def _conversation_with(db: AsyncSession, me: User, other_id: str) -> Conversation:
    """Find or create the thread between two people, canonically ordered."""
    if other_id == me.id:
        raise HTTPException(status_code=400, detail="You can't message yourself")

    other = (
        await db.execute(select(User).where(User.id == other_id))
    ).scalar_one_or_none()
    if not other:
        raise HTTPException(status_code=404, detail="No such user")

    a, b = Conversation.pair(me.id, other_id)
    convo = (
        await db.execute(
            select(Conversation).where(
                Conversation.user_a_id == a, Conversation.user_b_id == b
            )
        )
    ).scalar_one_or_none()
    if convo is None:
        convo = Conversation(user_a_id=a, user_b_id=b)
        db.add(convo)
        await db.flush()
    return convo


def _message_payload(msg: Message, film: Movie | None) -> dict:
    return {
        "id": msg.id,
        "senderId": msg.sender_id,
        "body": msg.body,
        "sharedFilm": film_payload(film) if film else None,
        "readAt": msg.read_at.isoformat() if msg.read_at else None,
        "createdAt": msg.created_at.isoformat(),
    }


@router.get("/conversations")
async def conversations(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The inbox — threads newest-active first, each with its other party."""
    rows = (
        await db.execute(
            select(Conversation)
            .where(or_(Conversation.user_a_id == me.id, Conversation.user_b_id == me.id))
            .order_by(Conversation.last_message_at.desc().nullslast())
        )
    ).scalars().all()

    other_ids = [c.user_b_id if c.user_a_id == me.id else c.user_a_id for c in rows]
    people = {
        u.id: u
        for u in (
            await db.execute(select(User).where(User.id.in_(other_ids)))
        ).scalars().all()
    } if other_ids else {}

    # Scoped to this caller's threads — without the id filter this scans every
    # message in the system on each inbox load and only then discards the rest.
    unread = dict(
        (
            await db.execute(
                select(Message.conversation_id, func.count())
                .where(
                    Message.conversation_id.in_([c.id for c in rows]),
                    Message.sender_id != me.id,
                    Message.read_at.is_(None),
                )
                .group_by(Message.conversation_id)
            )
        ).all()
    ) if rows else {}

    out = []
    for c in rows:
        other = people.get(c.user_b_id if c.user_a_id == me.id else c.user_a_id)
        if not other:
            continue
        out.append(
            {
                "id": c.id,
                "lastMessageAt": c.last_message_at.isoformat() if c.last_message_at else None,
                "lastPreview": c.last_preview,
                "unread": int(unread.get(c.id, 0)),
                "with": {
                    "id": other.id,
                    "name": other.name,
                    "username": other.username,
                    "avatarUrl": other.avatar_url,
                },
            }
        )
    return out


@router.get("/unread-count")
async def unread_count(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    convo_ids = (
        await db.execute(
            select(Conversation.id).where(
                or_(Conversation.user_a_id == me.id, Conversation.user_b_id == me.id)
            )
        )
    ).scalars().all()
    if not convo_ids:
        return {"count": 0}

    count = (
        await db.execute(
            select(func.count())
            .select_from(Message)
            .where(
                Message.conversation_id.in_(convo_ids),
                Message.sender_id != me.id,
                Message.read_at.is_(None),
            )
        )
    ).scalar_one()
    return {"count": int(count or 0)}


@router.post("/with/{user_id}")
async def send_to_user(
    user_id: str,
    body: SendBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send to a person, opening the thread if it doesn't exist yet.

    This is the entry point for "share this film" from a film page — the sender
    doesn't need to know whether they've spoken before.
    """
    convo = await _conversation_with(db, me, user_id)
    return await _append(db, convo, me, body)


@router.get("/conversations/{conversation_id}")
async def thread(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    convo = await _owned_conversation(db, conversation_id, me)

    rows = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == convo.id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    rows.reverse()

    film_ids = [m.shared_movie_id for m in rows if m.shared_movie_id]
    films = {
        f.id: f
        for f in (
            await db.execute(select(Movie).where(Movie.id.in_(film_ids)))
        ).scalars().all()
    } if film_ids else {}

    # Opening a thread marks the other side's messages read.
    await db.execute(
        update(Message)
        .where(
            Message.conversation_id == convo.id,
            Message.sender_id != me.id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )

    other_id = convo.user_b_id if convo.user_a_id == me.id else convo.user_a_id
    other = (await db.execute(select(User).where(User.id == other_id))).scalar_one()

    return {
        "id": convo.id,
        "with": {
            "id": other.id,
            "name": other.name,
            "username": other.username,
            "avatarUrl": other.avatar_url,
        },
        "messages": [
            _message_payload(m, films.get(m.shared_movie_id or "")) for m in rows
        ],
    }


@router.post("/conversations/{conversation_id}")
async def reply(
    conversation_id: str,
    body: SendBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    convo = await _owned_conversation(db, conversation_id, me)
    return await _append(db, convo, me, body)


async def _owned_conversation(
    db: AsyncSession, conversation_id: str, me: User
) -> Conversation:
    convo = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalar_one_or_none()
    if not convo or me.id not in (convo.user_a_id, convo.user_b_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return convo


async def _append(
    db: AsyncSession, convo: Conversation, me: User, body: SendBody
) -> dict:
    film = None
    if body.tmdb_id is not None:
        film = await get_or_fetch_film(body.tmdb_id, db)

    text = (body.body or "").strip() or None
    msg = Message(
        conversation_id=convo.id,
        sender_id=me.id,
        body=text,
        shared_movie_id=film.id if film else None,
    )
    db.add(msg)

    convo.last_message_at = datetime.now(timezone.utc)
    convo.last_preview = _preview(text, film)
    await db.flush()

    recipient_id = convo.user_b_id if convo.user_a_id == me.id else convo.user_a_id
    await notify(
        db,
        user_id=recipient_id,
        kind="message",
        payload={
            "conversationId": convo.id,
            "preview": convo.last_preview,
            "actor": {
                "id": me.id,
                "name": me.name,
                "username": me.username,
                "avatarUrl": me.avatar_url,
            },
        },
    )
    return {"conversationId": convo.id, **_message_payload(msg, film)}
