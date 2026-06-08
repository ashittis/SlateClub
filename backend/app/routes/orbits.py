"""
Orbits — the friend system. Search a user → send an orbit request →
recipient gets a notification and Accepts/Declines. An accepted orbit is
stored as a reciprocal pair of Follow rows, so Match-Cut's friend picker,
twins, and the Recommend list treat orbits as connections automatically.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.notifications import Notification
from ..models.social import Follow, OrbitRequest
from ..models.user import User
from ..services.notify import notify

router = APIRouter(prefix="/api/orbits", tags=["orbits"])


class TargetBody(BaseModel):
    user_id: str = Field(alias="userId")

    class Config:
        populate_by_name = True


def _actor(u: User) -> dict:
    return {"id": u.id, "name": u.name, "username": u.username, "avatarUrl": u.avatar_url}


def _user_lite(u: User) -> dict:
    return {"id": u.id, "name": u.name, "username": u.username, "avatarUrl": u.avatar_url}


async def _follows(db: AsyncSession, follower_id: str, following_id: str) -> bool:
    row = (
        await db.execute(
            select(Follow.id).where(
                Follow.follower_id == follower_id, Follow.following_id == following_id
            )
        )
    ).first()
    return row is not None


async def _ensure_follow(db: AsyncSession, follower_id: str, following_id: str) -> None:
    if not await _follows(db, follower_id, following_id):
        db.add(Follow(follower_id=follower_id, following_id=following_id))


async def _are_orbiting(db: AsyncSession, a: str, b: str) -> bool:
    return await _follows(db, a, b) and await _follows(db, b, a)


async def _resolve_orbit_notification(
    db: AsyncSession, user_id: str, request_id: str, status: str
) -> None:
    """Flip the recipient's 'orbit_request' notification to a resolved state so
    it stops showing Accept/Decline and reads as e.g. 'X is in your orbit'."""
    notifs = (
        await db.execute(
            select(Notification).where(
                Notification.user_id == user_id, Notification.kind == "orbit_request"
            )
        )
    ).scalars().all()
    for n in notifs:
        if isinstance(n.payload, dict) and n.payload.get("requestId") == request_id:
            n.payload = {**n.payload, "status": status}
            if n.read_at is None:
                n.read_at = datetime.now(timezone.utc)


# ── Requests ──────────────────────────────────────────────────


@router.post("/request")
async def send_request(
    body: TargetBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target_id = body.user_id
    if target_id == me.id:
        raise HTTPException(status_code=400, detail="Cannot orbit yourself")
    target = (await db.execute(select(User).where(User.id == target_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if await _are_orbiting(db, me.id, target_id):
        return {"status": "orbiting"}

    # If they already sent ME a pending request, accepting is the move.
    incoming = (
        await db.execute(
            select(OrbitRequest).where(
                OrbitRequest.from_id == target_id,
                OrbitRequest.to_id == me.id,
                OrbitRequest.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if incoming is not None:
        return {"status": "incoming", "requestId": incoming.id}

    # Upsert my outgoing request (unique from,to — reset a prior decline).
    mine = (
        await db.execute(
            select(OrbitRequest).where(
                OrbitRequest.from_id == me.id, OrbitRequest.to_id == target_id
            )
        )
    ).scalar_one_or_none()
    if mine is None:
        mine = OrbitRequest(from_id=me.id, to_id=target_id, status="pending")
        db.add(mine)
    else:
        mine.status = "pending"
        mine.created_at = datetime.now(timezone.utc)
        mine.responded_at = None
    await db.flush()

    await notify(
        db, user_id=target_id, kind="orbit_request",
        payload={"actor": _actor(me), "requestId": mine.id},
    )
    return {"status": "outgoing", "requestId": mine.id}


@router.get("/requests")
async def incoming_requests(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(OrbitRequest, User)
            .join(User, User.id == OrbitRequest.from_id)
            .where(OrbitRequest.to_id == me.id, OrbitRequest.status == "pending")
            .order_by(OrbitRequest.created_at.desc())
        )
    ).all()
    return {
        "items": [
            {"id": r.id, "createdAt": r.created_at, "from": _user_lite(u)}
            for r, u in rows
        ]
    }


@router.post("/requests/{request_id}/accept")
async def accept_request(
    request_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # No status filter — accept is idempotent (it may already be accepted via
    # the profile button), so clicking Accept on the notification still works.
    req = (
        await db.execute(
            select(OrbitRequest).where(
                OrbitRequest.id == request_id, OrbitRequest.to_id == me.id
            )
        )
    ).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")

    was_pending = req.status == "pending"
    if req.status != "accepted":
        req.status = "accepted"
        req.responded_at = datetime.now(timezone.utc)
    await _ensure_follow(db, req.from_id, req.to_id)
    await _ensure_follow(db, req.to_id, req.from_id)
    await _resolve_orbit_notification(db, me.id, request_id, "accepted")
    await db.flush()

    if was_pending:
        await notify(db, user_id=req.from_id, kind="orbit_accepted", payload={"actor": _actor(me)})
    return {"ok": True, "status": "orbiting"}


@router.post("/requests/{request_id}/decline")
async def decline_request(
    request_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = (
        await db.execute(
            select(OrbitRequest).where(
                OrbitRequest.id == request_id, OrbitRequest.to_id == me.id
            )
        )
    ).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status == "pending":
        req.status = "declined"
        req.responded_at = datetime.now(timezone.utc)
    await _resolve_orbit_notification(db, me.id, request_id, "declined")
    return {"ok": True}


# ── Orbit graph ───────────────────────────────────────────────


@router.get("")
async def my_orbits(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    following = {
        r[0] for r in (await db.execute(
            select(Follow.following_id).where(Follow.follower_id == me.id)
        )).all()
    }
    followers = {
        r[0] for r in (await db.execute(
            select(Follow.follower_id).where(Follow.following_id == me.id)
        )).all()
    }
    mutual = following & followers
    if not mutual:
        return {"items": []}
    users = (await db.execute(select(User).where(User.id.in_(list(mutual))))).scalars().all()
    return {"items": [_user_lite(u) for u in users]}


@router.get("/status/{user_id}")
async def orbit_status(
    user_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == me.id:
        return {"status": "self"}
    if await _are_orbiting(db, me.id, user_id):
        return {"status": "orbiting"}
    pending = (
        await db.execute(
            select(OrbitRequest).where(
                OrbitRequest.status == "pending",
                or_(
                    and_(OrbitRequest.from_id == me.id, OrbitRequest.to_id == user_id),
                    and_(OrbitRequest.from_id == user_id, OrbitRequest.to_id == me.id),
                ),
            )
        )
    ).scalars().all()
    for p in pending:
        if p.from_id == me.id:
            return {"status": "outgoing", "requestId": p.id}
        return {"status": "incoming", "requestId": p.id}
    return {"status": "none"}


@router.delete("/{user_id}")
async def remove_orbit(
    user_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete

    await db.execute(
        delete(Follow).where(
            or_(
                and_(Follow.follower_id == me.id, Follow.following_id == user_id),
                and_(Follow.follower_id == user_id, Follow.following_id == me.id),
            )
        )
    )
    await db.execute(
        delete(OrbitRequest).where(
            or_(
                and_(OrbitRequest.from_id == me.id, OrbitRequest.to_id == user_id),
                and_(OrbitRequest.from_id == user_id, OrbitRequest.to_id == me.id),
            )
        )
    )
    return {"ok": True, "status": "none"}
