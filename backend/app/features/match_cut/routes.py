"""
Match Cut API — taste compatibility between people.

- GET  /api/match-cut/{username}        → pairwise taste match (score + shared/disagree)
- POST /api/match-cut/recommendations   → group consensus picks ("movie night")
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.features.match_cut.models import MatchCut, MatchCutMember
from app.shared.models.user import User
from app.features.match_cut.service import match_cut_recommendations, taste_match
from app.shared.services.notify import notify

router = APIRouter(prefix="/api/match-cut", tags=["match-cut"])


class RecommendBody(BaseModel):
    friend_ids: list[str] = Field(default_factory=list, alias="friendIds")
    limit: int = Field(default=18, ge=1, le=40)

    class Config:
        populate_by_name = True


@router.get("/recommendations")
async def recommendations_help():
    # Guards against the /{username} route swallowing this path on GET.
    raise HTTPException(status_code=405, detail="Use POST for recommendations")


@router.post("/recommendations")
async def get_recommendations(
    body: RecommendBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member_ids = [me.id, *body.friend_ids]
    return await match_cut_recommendations(member_ids, db, limit=body.limit)


# ── Saved, invitable cuts (Spotify-Blend style) ───────────────
# NOTE: declared before /{username} so "cuts" isn't read as a username.


class CreateCutBody(BaseModel):
    title: str | None = None
    friend_id: str | None = Field(default=None, alias="friendId")

    class Config:
        populate_by_name = True


class JoinBody(BaseModel):
    token: str


class InviteBody(BaseModel):
    user_id: str = Field(alias="userId")

    class Config:
        populate_by_name = True


async def _cut_members(db: AsyncSession, cut_id: str) -> list[str]:
    rows = (
        await db.execute(select(MatchCutMember.user_id).where(MatchCutMember.cut_id == cut_id))
    ).all()
    return [r[0] for r in rows]


@router.post("/cuts")
async def create_cut(
    body: CreateCutBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Spotify-Blend style: a cut is a two-person taste blend. When a friend is
    # picked we add them straight away, auto-title the cut, and notify them.
    friend: User | None = None
    if body.friend_id and body.friend_id != me.id:
        friend = (
            await db.execute(select(User).where(User.id == body.friend_id))
        ).scalar_one_or_none()
        if friend is None:
            raise HTTPException(status_code=404, detail="Friend not found")

    def _first(name: str) -> str:
        return (name or "").strip().split(" ")[0] or "Someone"

    title = (body.title or "").strip()[:80]
    if not title:
        title = f"{_first(me.name)} × {_first(friend.name)}" if friend else "Untitled Cut"

    cut = MatchCut(creator_id=me.id, title=title)
    db.add(cut)
    await db.flush()
    db.add(MatchCutMember(cut_id=cut.id, user_id=me.id))
    if friend is not None:
        db.add(MatchCutMember(cut_id=cut.id, user_id=friend.id))
    await db.flush()

    if friend is not None:
        await notify(
            db, user_id=friend.id, kind="cut_invite",
            payload={
                "actor": {"id": me.id, "name": me.name, "username": me.username, "avatarUrl": me.avatar_url},
                "cutId": cut.id,
                "token": cut.invite_token,
                "title": cut.title,
            },
        )

    return {
        "id": cut.id,
        "title": cut.title,
        "inviteToken": cut.invite_token,
        "memberCount": 2 if friend is not None else 1,
        "isCreator": True,
    }


@router.get("/cuts")
async def my_cuts(
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cut_ids = [
        r[0] for r in (
            await db.execute(select(MatchCutMember.cut_id).where(MatchCutMember.user_id == me.id))
        ).all()
    ]
    if not cut_ids:
        return {"items": []}
    cuts = (
        await db.execute(
            select(MatchCut).where(MatchCut.id.in_(cut_ids)).order_by(MatchCut.created_at.desc())
        )
    ).scalars().all()
    counts = dict(
        (
            await db.execute(
                select(MatchCutMember.cut_id, func.count())
                .where(MatchCutMember.cut_id.in_(cut_ids))
                .group_by(MatchCutMember.cut_id)
            )
        ).all()
    )
    return {
        "items": [
            {
                "id": c.id,
                "title": c.title,
                "memberCount": int(counts.get(c.id, 1)),
                "isCreator": c.creator_id == me.id,
                "createdAt": c.created_at,
            }
            for c in cuts
        ]
    }


@router.get("/cuts/{cut_id}")
async def get_cut(
    cut_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cut = await db.get(MatchCut, cut_id)
    if cut is None:
        raise HTTPException(status_code=404, detail="Cut not found")
    member_ids = await _cut_members(db, cut_id)
    is_member = me.id in member_ids
    recs = (
        await match_cut_recommendations(member_ids, db, limit=24)
        if member_ids
        else {"members": [], "items": []}
    )
    return {
        "id": cut.id,
        "title": cut.title,
        "inviteToken": cut.invite_token,
        "isCreator": cut.creator_id == me.id,
        "isMember": is_member,
        "members": recs["members"],
        "items": recs["items"],
    }


@router.post("/cuts/{cut_id}/join")
async def join_cut(
    cut_id: str,
    body: JoinBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cut = await db.get(MatchCut, cut_id)
    if cut is None:
        raise HTTPException(status_code=404, detail="Cut not found")
    if cut.invite_token != body.token:
        raise HTTPException(status_code=403, detail="Invalid invite link")
    if me.id not in await _cut_members(db, cut_id):
        db.add(MatchCutMember(cut_id=cut_id, user_id=me.id))
        await db.flush()
    return {"ok": True, "joined": True}


@router.post("/cuts/{cut_id}/invite")
async def invite_to_cut(
    cut_id: str,
    body: InviteBody,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cut = await db.get(MatchCut, cut_id)
    if cut is None:
        raise HTTPException(status_code=404, detail="Cut not found")
    if me.id not in await _cut_members(db, cut_id):
        raise HTTPException(status_code=403, detail="Only members can invite")
    target = (await db.execute(select(User).where(User.id == body.user_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    await notify(
        db, user_id=target.id, kind="cut_invite",
        payload={
            "actor": {"id": me.id, "name": me.name, "username": me.username, "avatarUrl": me.avatar_url},
            "cutId": cut.id,
            "token": cut.invite_token,
            "title": cut.title,
        },
    )
    return {"ok": True}


@router.delete("/cuts/{cut_id}")
async def delete_cut(
    cut_id: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cut = await db.get(MatchCut, cut_id)
    if cut is None:
        raise HTTPException(status_code=404, detail="Cut not found")
    if cut.creator_id != me.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this cut")
    await db.delete(cut)
    return {"ok": True}


@router.get("/{username}")
async def get_match(
    username: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == me.id:
        raise HTTPException(status_code=400, detail="Cannot match with yourself")

    result = await taste_match(me.id, target.id, db)
    result["username"] = target.username
    result["name"] = target.name
    result["avatarUrl"] = target.avatar_url
    return result
