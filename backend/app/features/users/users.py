"""Users — finding people, and account settings.

Everything about a user *as a viewer* — their films, stats, favourites, diary —
lives in the passport slice. What's left here is the account itself: searching
for people to follow, and the preferences that govern who can see your passport.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.user import User, UserPreferences

router = APIRouter(prefix="/api/users", tags=["users"])


class PreferencesUpdate(BaseModel):
    notif_opt_out: list[str] | None = None
    profile_visibility: str | None = None


@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=1, max_length=64),
    limit: int = Query(20, ge=1, le=50),
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Find people by name or username.

    Prefix matches rank above substring matches, and shorter names break ties —
    searching "chris" should surface @chris before @christopher_nolan_fan_2004.
    """
    needle = q.strip()
    if not needle:
        return {"items": []}
    pattern, prefix = f"%{needle}%", f"{needle}%"

    stmt = (
        select(User)
        .where(or_(User.name.ilike(pattern), User.username.ilike(pattern)))
        .order_by(
            User.username.ilike(prefix).desc(),
            User.name.ilike(prefix).desc(),
            func.length(User.name).asc(),
        )
        .limit(limit)
    )
    if user is not None:
        stmt = stmt.where(User.id != user.id)

    return {
        "items": [
            {
                "id": u.id,
                "name": u.name,
                "username": u.username,
                "avatarUrl": u.avatar_url,
                "bio": u.bio,
            }
            for u in (await db.execute(stmt)).scalars().all()
        ]
    }


@router.get("/me/preferences")
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        return {"notifOptOut": [], "profileVisibility": "public"}
    return {
        "notifOptOut": row.notif_opt_out or [],
        "profileVisibility": row.profile_visibility,
    }


@router.patch("/me/preferences")
async def patch_preferences(
    body: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        row = UserPreferences(user_id=user.id)
        db.add(row)

    if body.notif_opt_out is not None:
        row.notif_opt_out = body.notif_opt_out
    if body.profile_visibility in ("public", "followers", "private"):
        row.profile_visibility = body.profile_visibility

    await db.flush()
    return {
        "notifOptOut": row.notif_opt_out or [],
        "profileVisibility": row.profile_visibility,
    }
