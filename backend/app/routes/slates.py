"""
Slates API — Phase 1.6

Slate = a user-curated film collection. Optionally collaborative.
Each Slate has a Slate Room: a threaded discussion attached to the
collection. Real-time push lands in P4 — until then the room polls
on a 30s interval.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.movie import Movie
from ..models.social import Follow
from ..models.slates import (
    SLATE_COLLAB_ROLES,
    SLATE_COVER_LAYOUTS,
    SLATE_VISIBILITIES,
    Slate,
    SlateCollaborator,
    SlateFilm,
    SlateLike,
    SlateRoomMessage,
    SlateSave,
)
from ..models.user import User
from ..services.notify import notify

router = APIRouter(prefix="/api/slates", tags=["slates"])


# ── Schemas ───────────────────────────────────────────────────


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CreateSlateIn(CamelModel):
    title: str
    description: str | None = None
    cover_layout: str = "mosaic_4"
    visibility: str = "public"
    is_collaborative: bool = False
    collaborator_ids: list[str] = []


class UpdateSlateIn(CamelModel):
    title: str | None = None
    description: str | None = None
    cover_layout: str | None = None
    visibility: str | None = None
    is_collaborative: bool | None = None


class AddFilmIn(CamelModel):
    tmdb_id: int
    media_type: str = "movie"
    note: str | None = None


class UpdateNoteIn(BaseModel):
    note: str | None


class ReorderItem(CamelModel):
    tmdb_id: int
    media_type: str = "movie"


class ReorderIn(CamelModel):
    items: list[ReorderItem]


class InviteIn(CamelModel):
    user_id: str
    role: str = "contributor"


class RoomMessageIn(CamelModel):
    body: str
    parent_id: str | None = None


# ── Helpers ───────────────────────────────────────────────────


async def _get_slate_or_404(slate_id: str, db: AsyncSession) -> Slate:
    row = (
        await db.execute(select(Slate).where(Slate.id == slate_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Slate not found")
    return row


async def _can_edit(slate: Slate, user_id: str, db: AsyncSession) -> bool:
    if slate.creator_id == user_id:
        return True
    if not slate.is_collaborative:
        return False
    collab = await db.execute(
        select(SlateCollaborator)
        .where(SlateCollaborator.slate_id == slate.id)
        .where(SlateCollaborator.user_id == user_id)
    )
    return collab.scalar_one_or_none() is not None


async def _can_view(slate: Slate, user: User | None, db: AsyncSession) -> bool:
    """Public/unlisted slates are visible to all. Private slates are visible to
    the creator, collaborators, and users in the creator's orbit (mutual follow)."""
    if slate.visibility != "private":
        return True
    if user is None:
        return False
    if user.id == slate.creator_id:
        return True
    collab = (
        await db.execute(
            select(SlateCollaborator)
            .where(SlateCollaborator.slate_id == slate.id)
            .where(SlateCollaborator.user_id == user.id)
        )
    ).scalar_one_or_none()
    if collab is not None:
        return True
    # Orbit = mutual follow between the viewer and the creator.
    a = (
        await db.execute(
            select(Follow).where(
                Follow.follower_id == user.id, Follow.following_id == slate.creator_id
            )
        )
    ).scalar_one_or_none()
    b = (
        await db.execute(
            select(Follow).where(
                Follow.follower_id == slate.creator_id, Follow.following_id == user.id
            )
        )
    ).scalar_one_or_none()
    return a is not None and b is not None


async def _enrich_films(
    db: AsyncSession, films: list[SlateFilm]
) -> list[dict]:
    if not films:
        return []
    tmdb_ids = [f.tmdb_id for f in films]
    movie_rows = (
        await db.execute(select(Movie).where(Movie.tmdb_id.in_(tmdb_ids)))
    ).scalars().all()
    by_key = {(m.tmdb_id, m.media_type): m for m in movie_rows}
    out = []
    for f in films:
        m = by_key.get((f.tmdb_id, f.media_type))
        out.append(
            {
                "tmdbId": f.tmdb_id,
                "mediaType": f.media_type,
                "note": f.note,
                "position": f.position,
                "addedByUserId": f.added_by_user_id,
                "addedAt": f.added_at.isoformat(),
                "title": m.title if m else None,
                "posterPath": m.poster_path if m else None,
                "releaseDate": m.release_date if m else None,
                "originalLanguage": m.original_language if m else None,
            }
        )
    return out


async def _like_info(db: AsyncSession, slate_id: str, user: User | None) -> tuple[int, bool]:
    count = (
        await db.execute(
            select(func.count()).where(SlateLike.slate_id == slate_id)
        )
    ).scalar_one()
    liked = False
    if user is not None:
        liked = (
            await db.execute(
                select(SlateLike)
                .where(SlateLike.slate_id == slate_id)
                .where(SlateLike.user_id == user.id)
            )
        ).scalar_one_or_none() is not None
    return count, liked


def _slate_summary(
    slate: Slate, films: list[SlateFilm], saves: int, collaborators: list[SlateCollaborator]
) -> dict:
    cover_paths: list[str] = []
    for f in films[:4]:
        # Lazy fill from joined movie data — caller passes enriched film dicts
        # for full detail; summary uses tmdb_id only.
        cover_paths.append(str(f.tmdb_id))
    return {
        "id": slate.id,
        "title": slate.title,
        "description": slate.description,
        "coverLayout": slate.cover_layout,
        "visibility": slate.visibility,
        "isCollaborative": slate.is_collaborative,
        "creatorId": slate.creator_id,
        "filmCount": len(films),
        "saveCount": saves,
        "collaboratorCount": len(collaborators),
        "createdAt": slate.created_at.isoformat(),
        "updatedAt": slate.updated_at.isoformat(),
    }


async def _slate_card(slate: Slate, db: AsyncSession, user: User | None = None) -> dict:
    """Returns a Slate library card payload — enough for SlateCard.tsx."""
    films = (
        await db.execute(
            select(SlateFilm)
            .where(SlateFilm.slate_id == slate.id)
            .order_by(SlateFilm.position)
            .limit(8)
        )
    ).scalars().all()
    saves = (
        await db.execute(
            select(func.count()).where(SlateSave.slate_id == slate.id)
        )
    ).scalar_one()
    collaborators = (
        await db.execute(
            select(SlateCollaborator).where(SlateCollaborator.slate_id == slate.id)
        )
    ).scalars().all()
    creator = (
        await db.execute(select(User).where(User.id == slate.creator_id))
    ).scalar_one_or_none()
    like_count, liked_by_me = await _like_info(db, slate.id, user)

    enriched = await _enrich_films(db, films)
    summary = _slate_summary(slate, films, saves, collaborators)
    summary["likeCount"] = like_count
    summary["likedByMe"] = liked_by_me
    summary["coverPosters"] = [f.get("posterPath") for f in enriched if f.get("posterPath")][:4]
    summary["creator"] = (
        {
            "id": creator.id,
            "name": creator.name,
            "username": creator.username,
            "avatarUrl": creator.avatar_url,
        }
        if creator
        else None
    )
    return summary


# ── CRUD ──────────────────────────────────────────────────────


@router.post("")
async def create_slate(
    body: CreateSlateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.cover_layout not in SLATE_COVER_LAYOUTS:
        raise HTTPException(status_code=400, detail="invalid cover_layout")
    if body.visibility not in SLATE_VISIBILITIES:
        raise HTTPException(status_code=400, detail="invalid visibility")
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title required")

    collab_ids = [c for c in dict.fromkeys(body.collaborator_ids) if c != user.id]
    slate = Slate(
        creator_id=user.id,
        title=title,
        description=body.description,
        cover_layout=body.cover_layout,
        visibility=body.visibility,
        is_collaborative=body.is_collaborative or bool(collab_ids),
    )
    db.add(slate)
    await db.flush()
    for cid in collab_ids:
        exists = (
            await db.execute(select(User).where(User.id == cid))
        ).scalar_one_or_none()
        if exists:
            db.add(SlateCollaborator(slate_id=slate.id, user_id=cid, role="contributor"))
    await db.flush()
    return await _slate_card(slate, db, user)


@router.get("/mine")
async def list_my_slates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Slate)
            .where(Slate.creator_id == user.id)
            .order_by(desc(Slate.updated_at))
        )
    ).scalars().all()
    return {"items": [await _slate_card(s, db, user) for s in rows]}


@router.get("/saved")
async def list_saved_slates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Slate)
            .join(SlateSave, SlateSave.slate_id == Slate.id)
            .where(SlateSave.user_id == user.id)
            .order_by(desc(SlateSave.saved_at))
        )
    ).scalars().all()
    return {"items": [await _slate_card(s, db, user) for s in rows]}


@router.get("/collaborative")
async def list_collaborative_slates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Slates the user collaborates on (not their own)."""
    rows = (
        await db.execute(
            select(Slate)
            .join(SlateCollaborator, SlateCollaborator.slate_id == Slate.id)
            .where(SlateCollaborator.user_id == user.id)
            .order_by(desc(Slate.updated_at))
        )
    ).scalars().all()
    return {"items": [await _slate_card(s, db, user) for s in rows]}


@router.get("/by-user/{username}")
async def list_user_slates(
    username: str,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A user's created slates that the viewer is allowed to see."""
    target = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    rows = (
        await db.execute(
            select(Slate)
            .where(Slate.creator_id == target.id)
            .order_by(desc(Slate.updated_at))
        )
    ).scalars().all()
    visible = [s for s in rows if await _can_view(s, user, db)]
    return {"items": [await _slate_card(s, db, user) for s in visible]}


@router.get("/featured")
async def list_featured_slates(
    db: AsyncSession = Depends(get_db),
):
    """
    Top public slates by recent saves. With no saves yet, fall back to
    most recently updated public slates.
    """
    since = datetime.now(timezone.utc) - timedelta(days=7)
    save_count_subq = (
        select(SlateSave.slate_id, func.count().label("c"))
        .where(SlateSave.saved_at >= since)
        .group_by(SlateSave.slate_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Slate)
            .where(Slate.visibility == "public")
            .outerjoin(save_count_subq, save_count_subq.c.slate_id == Slate.id)
            .order_by(
                desc(func.coalesce(save_count_subq.c.c, 0)),
                desc(Slate.updated_at),
            )
            .limit(8)
        )
    ).scalars().all()
    return {"items": [await _slate_card(s, db) for s in rows]}


@router.get("/{slate_id}")
async def get_slate(
    slate_id: str,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)

    if not await _can_view(slate, user, db):
        raise HTTPException(status_code=404, detail="Slate not found")

    films = (
        await db.execute(
            select(SlateFilm)
            .where(SlateFilm.slate_id == slate.id)
            .order_by(SlateFilm.position)
        )
    ).scalars().all()
    saves = (
        await db.execute(
            select(func.count()).where(SlateSave.slate_id == slate.id)
        )
    ).scalar_one()
    collab_rows = (
        await db.execute(
            select(SlateCollaborator, User)
            .join(User, SlateCollaborator.user_id == User.id)
            .where(SlateCollaborator.slate_id == slate.id)
        )
    ).all()

    creator = (
        await db.execute(select(User).where(User.id == slate.creator_id))
    ).scalar_one_or_none()

    enriched_films = await _enrich_films(db, films)
    summary = _slate_summary(slate, films, saves, [c for c, _ in collab_rows])
    like_count, liked_by_me = await _like_info(db, slate.id, user)
    can_edit = user is not None and await _can_edit(slate, user.id, db)
    return {
        **summary,
        "likeCount": like_count,
        "likedByMe": liked_by_me,
        "canEdit": can_edit,
        "creator": creator
        and {
            "id": creator.id,
            "name": creator.name,
            "username": creator.username,
            "avatarUrl": creator.avatar_url,
        },
        "collaborators": [
            {
                "id": u.id,
                "name": u.name,
                "username": u.username,
                "avatarUrl": u.avatar_url,
                "role": c.role,
            }
            for c, u in collab_rows
        ],
        "films": enriched_films,
        "savedByMe": (
            user is not None
            and (
                await db.execute(
                    select(SlateSave)
                    .where(SlateSave.slate_id == slate.id)
                    .where(SlateSave.user_id == user.id)
                )
            ).scalar_one_or_none()
            is not None
        ),
    }


@router.patch("/{slate_id}")
async def patch_slate(
    slate_id: str,
    body: UpdateSlateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if slate.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Only the creator can edit")
    if body.title is not None:
        slate.title = body.title.strip()
    if body.description is not None:
        slate.description = body.description
    if body.cover_layout is not None:
        if body.cover_layout not in SLATE_COVER_LAYOUTS:
            raise HTTPException(status_code=400, detail="invalid cover_layout")
        slate.cover_layout = body.cover_layout
    if body.visibility is not None:
        if body.visibility not in SLATE_VISIBILITIES:
            raise HTTPException(status_code=400, detail="invalid visibility")
        slate.visibility = body.visibility
    if body.is_collaborative is not None:
        slate.is_collaborative = body.is_collaborative
    await db.flush()
    return await _slate_card(slate, db, user)


@router.delete("/{slate_id}")
async def delete_slate(
    slate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if slate.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete")
    await db.delete(slate)
    return {"ok": True}


# ── Films ─────────────────────────────────────────────────────


@router.post("/{slate_id}/films")
async def add_film(
    slate_id: str,
    body: AddFilmIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if not await _can_edit(slate, user.id, db):
        raise HTTPException(status_code=403, detail="Not allowed")
    existing = (
        await db.execute(
            select(SlateFilm)
            .where(SlateFilm.slate_id == slate.id)
            .where(SlateFilm.tmdb_id == body.tmdb_id)
            .where(SlateFilm.media_type == body.media_type)
        )
    ).scalar_one_or_none()
    if existing:
        return {"ok": True, "duplicate": True}

    last_pos = (
        await db.execute(
            select(func.max(SlateFilm.position)).where(SlateFilm.slate_id == slate.id)
        )
    ).scalar_one() or 0

    db.add(
        SlateFilm(
            slate_id=slate.id,
            tmdb_id=body.tmdb_id,
            media_type=body.media_type,
            note=body.note,
            position=last_pos + 1,
            added_by_user_id=user.id,
        )
    )
    await db.flush()
    return {"ok": True}


@router.delete("/{slate_id}/films/{tmdb_id}")
async def remove_film(
    slate_id: str,
    tmdb_id: int,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if not await _can_edit(slate, user.id, db):
        raise HTTPException(status_code=403, detail="Not allowed")
    row = (
        await db.execute(
            select(SlateFilm)
            .where(SlateFilm.slate_id == slate.id)
            .where(SlateFilm.tmdb_id == tmdb_id)
            .where(SlateFilm.media_type == media_type)
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True}


@router.patch("/{slate_id}/films/reorder")
async def reorder_films(
    slate_id: str,
    body: ReorderIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if not await _can_edit(slate, user.id, db):
        raise HTTPException(status_code=403, detail="Not allowed")
    rows = (
        await db.execute(
            select(SlateFilm).where(SlateFilm.slate_id == slate.id)
        )
    ).scalars().all()
    by_key = {(r.tmdb_id, r.media_type): r for r in rows}
    for idx, item in enumerate(body.items):
        row = by_key.get((item.tmdb_id, item.media_type))
        if row is not None:
            row.position = idx + 1
    await db.flush()
    return {"ok": True}


@router.patch("/{slate_id}/films/{tmdb_id}/note")
async def update_film_note(
    slate_id: str,
    tmdb_id: int,
    body: UpdateNoteIn,
    media_type: str = Query("movie", alias="mediaType"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if not await _can_edit(slate, user.id, db):
        raise HTTPException(status_code=403, detail="Not allowed")
    row = (
        await db.execute(
            select(SlateFilm)
            .where(SlateFilm.slate_id == slate.id)
            .where(SlateFilm.tmdb_id == tmdb_id)
            .where(SlateFilm.media_type == media_type)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Film not in slate")
    row.note = body.note
    await db.flush()
    return {"ok": True}


# ── Like / unlike ─────────────────────────────────────────────


@router.post("/{slate_id}/like")
async def like_slate(
    slate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    existing = (
        await db.execute(
            select(SlateLike)
            .where(SlateLike.slate_id == slate.id)
            .where(SlateLike.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(SlateLike(slate_id=slate.id, user_id=user.id))
        await db.flush()
        if slate.creator_id != user.id:
            await notify(
                db,
                user_id=slate.creator_id,
                kind="slate_like",
                payload={
                    "slateId": slate.id,
                    "slateTitle": slate.title,
                    "actor": {
                        "id": user.id,
                        "name": user.name,
                        "username": user.username,
                        "avatarUrl": user.avatar_url,
                    },
                },
            )
    return {"ok": True}


@router.delete("/{slate_id}/like")
async def unlike_slate(
    slate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    row = (
        await db.execute(
            select(SlateLike)
            .where(SlateLike.slate_id == slate.id)
            .where(SlateLike.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True}


# ── Save / unsave ─────────────────────────────────────────────


@router.post("/{slate_id}/save")
async def save_slate(
    slate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    existing = (
        await db.execute(
            select(SlateSave)
            .where(SlateSave.slate_id == slate.id)
            .where(SlateSave.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(SlateSave(slate_id=slate.id, user_id=user.id))
        await db.flush()
        if slate.creator_id != user.id:
            await notify(
                db,
                user_id=slate.creator_id,
                kind="slate_save",
                payload={
                    "slateId": slate.id,
                    "slateTitle": slate.title,
                    "actor": {
                        "id": user.id,
                        "name": user.name,
                        "username": user.username,
                        "avatarUrl": user.avatar_url,
                    },
                },
            )
    return {"ok": True}


@router.delete("/{slate_id}/save")
async def unsave_slate(
    slate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    row = (
        await db.execute(
            select(SlateSave)
            .where(SlateSave.slate_id == slate.id)
            .where(SlateSave.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    return {"ok": True}


# ── Collaborators ─────────────────────────────────────────────


@router.post("/{slate_id}/collaborators")
async def invite_collaborator(
    slate_id: str,
    body: InviteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if slate.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Only creator can invite")
    if body.role not in SLATE_COLLAB_ROLES:
        raise HTTPException(status_code=400, detail="invalid role")
    target = (
        await db.execute(select(User).where(User.id == body.user_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.add(
        SlateCollaborator(slate_id=slate.id, user_id=target.id, role=body.role)
    )
    slate.is_collaborative = True
    await db.flush()
    return {"ok": True}


@router.delete("/{slate_id}/collaborators/{collab_user_id}")
async def remove_collaborator(
    slate_id: str,
    collab_user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    if slate.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Only creator can remove")
    row = (
        await db.execute(
            select(SlateCollaborator)
            .where(SlateCollaborator.slate_id == slate.id)
            .where(SlateCollaborator.user_id == collab_user_id)
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
    await db.flush()
    return {"ok": True}


# ── Slate Room ────────────────────────────────────────────────


@router.get("/{slate_id}/room")
async def list_room_messages(
    slate_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    rows = (
        await db.execute(
            select(SlateRoomMessage, User)
            .join(User, User.id == SlateRoomMessage.user_id)
            .where(SlateRoomMessage.slate_id == slate.id)
            .order_by(SlateRoomMessage.created_at.desc())
            .limit(limit)
        )
    ).all()
    rows.reverse()
    return {
        "messages": [
            {
                "id": m.id,
                "body": m.body,
                "parentId": m.parent_id,
                "createdAt": m.created_at.isoformat(),
                "user": {
                    "id": u.id,
                    "name": u.name,
                    "username": u.username,
                    "avatarUrl": u.avatar_url,
                },
            }
            for m, u in rows
        ]
    }


@router.post("/{slate_id}/room")
async def post_room_message(
    slate_id: str,
    body: RoomMessageIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slate = await _get_slate_or_404(slate_id, db)
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty message")
    msg = SlateRoomMessage(
        slate_id=slate.id, user_id=user.id, body=text, parent_id=body.parent_id
    )
    db.add(msg)
    await db.flush()

    # Fan-out to creator + collaborators + savers, minus the sender.
    recipient_ids: set[str] = {slate.creator_id}
    collabs = (
        await db.execute(
            select(SlateCollaborator.user_id).where(
                SlateCollaborator.slate_id == slate.id
            )
        )
    ).all()
    recipient_ids.update(r[0] for r in collabs)
    savers = (
        await db.execute(
            select(SlateSave.user_id).where(SlateSave.slate_id == slate.id)
        )
    ).all()
    recipient_ids.update(r[0] for r in savers)
    recipient_ids.discard(user.id)
    for rid in recipient_ids:
        await notify(
            db,
            user_id=rid,
            kind="slate_message",
            payload={
                "slateId": slate.id,
                "slateTitle": slate.title,
                "preview": text[:120],
                "actor": {
                    "id": user.id,
                    "name": user.name,
                    "username": user.username,
                    "avatarUrl": user.avatar_url,
                },
            },
        )

    return {
        "id": msg.id,
        "body": msg.body,
        "parentId": msg.parent_id,
        "createdAt": msg.created_at.isoformat(),
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "avatarUrl": user.avatar_url,
        },
    }


# ── From-twins (used by Discover row) ────────────────────────


@router.get("/from-twins")
async def slates_from_twins(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Public slates created by users in the requesting user's taste
    neighbourhood. The neighbour set comes from the taste graph in P2.1.
    Until that's wired, return the most-saved public slates from other users.
    """
    rows = (
        await db.execute(
            select(Slate)
            .where(Slate.visibility == "public")
            .where(Slate.creator_id != user.id)
            .order_by(desc(Slate.updated_at))
            .limit(8)
        )
    ).scalars().all()
    return {"items": [await _slate_card(s, db) for s in rows]}
