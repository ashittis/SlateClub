from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.social import Follow
from app.shared.models.user import User
from app.shared.services.notify import notify

router = APIRouter(prefix="/api/follows", tags=["follows"])


# ── Schemas ──────────────────────────────────────────────────

class FollowRequest(BaseModel):
    user_id: str


class FollowUserResponse(BaseModel):
    id: str
    name: str
    username: str
    avatar_url: str | None = None

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────

@router.post("/")
async def follow_user(
    body: FollowRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    # Check target exists
    target = await db.execute(select(User).where(User.id == body.user_id))
    if not target.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    # Check not already following
    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == user.id, Follow.following_id == body.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already following")

    follow = Follow(follower_id=user.id, following_id=body.user_id)
    db.add(follow)
    await db.flush()

    await notify(
        db,
        user_id=body.user_id,
        kind="follow",
        payload={
            "actor": {
                "id": user.id,
                "name": user.name,
                "username": user.username,
                "avatarUrl": user.avatar_url,
            },
        },
    )
    return {"ok": True}


@router.delete("/{user_id}")
async def unfollow_user(
    user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.following_id == user_id)
    )
    follow = result.scalar_one_or_none()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following this user")

    await db.delete(follow)
    await db.flush()
    return {"ok": True}


@router.get("/{user_id}/followers", response_model=list[FollowUserResponse])
async def get_followers(
    user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.following_id == user_id)
        .order_by(Follow.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{user_id}/following", response_model=list[FollowUserResponse])
async def get_following(
    user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .join(Follow, Follow.following_id == User.id)
        .where(Follow.follower_id == user_id)
        .order_by(Follow.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{user_id}/check")
async def check_following(
    user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.following_id == user_id)
    )
    return {"following": result.scalar_one_or_none() is not None}
