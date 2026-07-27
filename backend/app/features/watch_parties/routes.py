"""
Watch Parties API — Phase 4.1

Synced viewing for OTT films. Real-time push lands in a follow-up
WebSocket/Socket.io layer; for now participants poll
`/parties/{id}/state` every 5s and `/reactions` every 3s.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.user import User
from app.features.watch_parties.models import (
    WATCH_PARTY_STATUSES,
    WatchParty,
    WatchPartyParticipant,
    WatchPartyReaction,
)

router = APIRouter(prefix="/api/parties", tags=["watch-parties"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CreatePartyIn(CamelModel):
    tmdb_id: int
    title: str
    starts_at: datetime


@router.post("")
async def create_party(
    body: CreatePartyIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    party = WatchParty(
        host_id=user.id,
        tmdb_id=body.tmdb_id,
        title=body.title,
        starts_at=body.starts_at,
    )
    db.add(party)
    await db.flush()
    db.add(WatchPartyParticipant(party_id=party.id, user_id=user.id))
    await db.flush()
    return _payload(party)


@router.get("/{party_id}")
async def get_party(
    party_id: str,
    db: AsyncSession = Depends(get_db),
):
    party = await _get_or_404(party_id, db)
    return _payload(party)


@router.post("/{party_id}/join")
async def join_party(
    party_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    party = await _get_or_404(party_id, db)
    existing = (
        await db.execute(
            select(WatchPartyParticipant).where(
                WatchPartyParticipant.party_id == party.id,
                WatchPartyParticipant.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(WatchPartyParticipant(party_id=party.id, user_id=user.id))
        await db.flush()
    return {"ok": True}


@router.delete("/{party_id}/join")
async def leave_party(
    party_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(WatchPartyParticipant).where(
                WatchPartyParticipant.party_id == party_id,
                WatchPartyParticipant.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True}


class PlaybackUpdate(BaseModel):
    playback_seconds: float = Field(ge=0)
    status: str | None = None


@router.post("/{party_id}/playback")
async def update_playback(
    party_id: str,
    body: PlaybackUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Host-only: pushes the current playback cursor + status."""
    party = await _get_or_404(party_id, db)
    if party.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can drive playback")
    party.playback_seconds = body.playback_seconds
    party.playback_updated_at = datetime.now(timezone.utc)
    if body.status and body.status in WATCH_PARTY_STATUSES:
        party.status = body.status
    await db.flush()
    return _payload(party)


@router.get("/{party_id}/state")
async def get_state(
    party_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Cheap polling endpoint for participants."""
    party = await _get_or_404(party_id, db)
    participants = (
        await db.execute(
            select(WatchPartyParticipant).where(
                WatchPartyParticipant.party_id == party.id
            )
        )
    ).scalars().all()
    return {
        "playbackSeconds": party.playback_seconds,
        "playbackUpdatedAt": party.playback_updated_at.isoformat(),
        "status": party.status,
        "participantCount": len(participants),
    }


class ReactionIn(CamelModel):
    body: str
    playback_seconds: float = Field(ge=0)


@router.post("/{party_id}/reactions")
async def post_reaction(
    party_id: str,
    body: ReactionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    party = await _get_or_404(party_id, db)
    text = body.body.strip()[:280]
    if not text:
        raise HTTPException(status_code=400, detail="empty reaction")
    r = WatchPartyReaction(
        party_id=party.id,
        user_id=user.id,
        body=text,
        playback_seconds=body.playback_seconds,
    )
    db.add(r)
    await db.flush()
    return {"id": r.id}


@router.get("/{party_id}/reactions")
async def list_reactions(
    party_id: str,
    since: float | None = Query(None),
    limit: int = Query(80, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Most-recent reactions, optionally filtered to those after a given
    playback second (so polling clients don't re-render seen items)."""
    party = await _get_or_404(party_id, db)
    stmt = (
        select(WatchPartyReaction, User)
        .join(User, User.id == WatchPartyReaction.user_id)
        .where(WatchPartyReaction.party_id == party.id)
        .order_by(desc(WatchPartyReaction.created_at))
        .limit(limit)
    )
    if since is not None:
        stmt = stmt.where(WatchPartyReaction.playback_seconds >= since)
    rows = (await db.execute(stmt)).all()
    rows.reverse()
    return {
        "items": [
            {
                "id": r.id,
                "body": r.body,
                "playbackSeconds": r.playback_seconds,
                "createdAt": r.created_at.isoformat(),
                "user": {
                    "id": u.id,
                    "name": u.name,
                    "username": u.username,
                    "avatarUrl": u.avatar_url,
                },
            }
            for r, u in rows
        ]
    }


# ── helpers ───────────────────────────────────────────────────


async def _get_or_404(party_id: str, db: AsyncSession) -> WatchParty:
    party = (
        await db.execute(
            select(WatchParty).where(WatchParty.id == party_id)
        )
    ).scalar_one_or_none()
    if party is None:
        raise HTTPException(status_code=404)
    return party


def _payload(p: WatchParty) -> dict:
    return {
        "id": p.id,
        "tmdbId": p.tmdb_id,
        "title": p.title,
        "hostId": p.host_id,
        "startsAt": p.starts_at.isoformat(),
        "status": p.status,
        "playbackSeconds": p.playback_seconds,
        "playbackUpdatedAt": p.playback_updated_at.isoformat(),
    }
