"""Named watchlists — collections a user makes on purpose.

Distinct from the single implicit watchlist (`/api/watchlist`), which is the
"save this for later" button. A collection here is curated and *ordered*: the
order is the user's editorial choice, so it's stored, not derived.

Replaces SlateClub's "Slates", minus the parts that were a different product:
collaborators, likes, saves, and the per-slate chat room.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_optional_user
from app.core.database import get_db
from app.shared.models.collections import Watchlist, WatchlistFilm
from app.shared.models.user import User

router = APIRouter(prefix="/api/watchlists", tags=["watchlists"])

MAX_FILMS = 250


class CreateBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    visibility: str = "public"


class UpdateBody(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = None
    visibility: str | None = None


class AddFilmBody(BaseModel):
    tmdb_id: int = Field(..., alias="tmdbId")
    title: str
    poster_path: str | None = Field(None, alias="posterPath")
    year: str | None = None
    note: str | None = None

    model_config = {"populate_by_name": True}


class ReorderBody(BaseModel):
    """The full ordered list of tmdb ids. Sending the whole order rather than a
    move instruction keeps drag-and-drop idempotent under concurrent edits."""

    tmdb_ids: list[int] = Field(..., alias="tmdbIds")

    model_config = {"populate_by_name": True}


def _summary(wl: Watchlist, count: int, covers: list[str | None]) -> dict:
    return {
        "id": wl.id,
        "title": wl.title,
        "description": wl.description,
        "visibility": wl.visibility,
        "filmCount": count,
        # A few posters so the list can render a collage without loading it all.
        "covers": covers,
        "updatedAt": wl.updated_at.isoformat(),
    }


def _film(f: WatchlistFilm) -> dict:
    return {
        "tmdbId": f.tmdb_id,
        "title": f.title,
        "posterPath": f.poster_path,
        "year": f.year,
        "note": f.note,
        "position": f.position,
    }


async def _owned(db: AsyncSession, watchlist_id: str, user: User) -> Watchlist:
    wl = (
        await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id))
    ).scalar_one_or_none()
    if not wl or wl.user_id != user.id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return wl


@router.post("")
async def create(
    body: CreateBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wl = Watchlist(
        user_id=user.id,
        title=body.title.strip(),
        description=(body.description or "").strip() or None,
        visibility=body.visibility if body.visibility in ("public", "private") else "public",
    )
    db.add(wl)
    await db.flush()
    return _summary(wl, 0, [])


@router.get("")
async def mine(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lists = (
        await db.execute(
            select(Watchlist)
            .where(Watchlist.user_id == user.id)
            .order_by(Watchlist.updated_at.desc())
        )
    ).scalars().all()
    return [await _hydrate(db, wl) for wl in lists]


async def _hydrate(db: AsyncSession, wl: Watchlist) -> dict:
    count = int(
        (
            await db.execute(
                select(func.count()).select_from(WatchlistFilm).where(
                    WatchlistFilm.watchlist_id == wl.id
                )
            )
        ).scalar_one()
        or 0
    )
    covers = (
        await db.execute(
            select(WatchlistFilm.poster_path)
            .where(WatchlistFilm.watchlist_id == wl.id)
            .order_by(WatchlistFilm.position)
            .limit(4)
        )
    ).scalars().all()
    return _summary(wl, count, list(covers))


@router.get("/{watchlist_id}")
async def detail(
    watchlist_id: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    wl = (
        await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id))
    ).scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    is_owner = bool(viewer and viewer.id == wl.user_id)
    if wl.visibility == "private" and not is_owner:
        raise HTTPException(status_code=403, detail="This watchlist is private")

    films = (
        await db.execute(
            select(WatchlistFilm)
            .where(WatchlistFilm.watchlist_id == wl.id)
            .order_by(WatchlistFilm.position)
        )
    ).scalars().all()

    owner = (await db.execute(select(User).where(User.id == wl.user_id))).scalar_one()
    return {
        "id": wl.id,
        "title": wl.title,
        "description": wl.description,
        "visibility": wl.visibility,
        "isOwner": is_owner,
        "owner": {"name": owner.name, "username": owner.username, "avatarUrl": owner.avatar_url},
        "films": [_film(f) for f in films],
    }


@router.patch("/{watchlist_id}")
async def update(
    watchlist_id: str,
    body: UpdateBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wl = await _owned(db, watchlist_id, user)
    if body.title is not None:
        wl.title = body.title.strip()
    if body.description is not None:
        wl.description = body.description.strip() or None
    if body.visibility in ("public", "private"):
        wl.visibility = body.visibility
    await db.flush()
    return await _hydrate(db, wl)


@router.delete("/{watchlist_id}")
async def remove(
    watchlist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wl = await _owned(db, watchlist_id, user)
    await db.delete(wl)
    await db.flush()
    return {"ok": True}


@router.post("/{watchlist_id}/films")
async def add_film(
    watchlist_id: str,
    body: AddFilmBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wl = await _owned(db, watchlist_id, user)

    existing = (
        await db.execute(
            select(WatchlistFilm).where(
                WatchlistFilm.watchlist_id == wl.id, WatchlistFilm.tmdb_id == body.tmdb_id
            )
        )
    ).scalar_one_or_none()
    if existing:
        # Adding twice is a no-op, not an error — the user's intent is satisfied.
        return {"ok": True, "added": False}

    count = int(
        (
            await db.execute(
                select(func.count()).select_from(WatchlistFilm).where(
                    WatchlistFilm.watchlist_id == wl.id
                )
            )
        ).scalar_one()
        or 0
    )
    if count >= MAX_FILMS:
        raise HTTPException(status_code=422, detail=f"A list holds at most {MAX_FILMS} films")

    db.add(
        WatchlistFilm(
            watchlist_id=wl.id,
            tmdb_id=body.tmdb_id,
            title=body.title,
            poster_path=body.poster_path,
            year=body.year,
            note=body.note,
            position=count,
        )
    )
    wl.updated_at = func.now()
    await db.flush()
    return {"ok": True, "added": True}


@router.delete("/{watchlist_id}/films/{tmdb_id}")
async def remove_film(
    watchlist_id: str,
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wl = await _owned(db, watchlist_id, user)
    row = (
        await db.execute(
            select(WatchlistFilm).where(
                WatchlistFilm.watchlist_id == wl.id, WatchlistFilm.tmdb_id == tmdb_id
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Not in this list")

    await db.delete(row)
    await db.flush()

    # Close the gap so positions stay contiguous — otherwise repeated removals
    # leave holes that make later reordering behave unpredictably.
    remaining = (
        await db.execute(
            select(WatchlistFilm)
            .where(WatchlistFilm.watchlist_id == wl.id)
            .order_by(WatchlistFilm.position)
        )
    ).scalars().all()
    for i, f in enumerate(remaining):
        f.position = i
    await db.flush()
    return {"ok": True}


@router.patch("/{watchlist_id}/films/reorder")
async def reorder(
    watchlist_id: str,
    body: ReorderBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wl = await _owned(db, watchlist_id, user)
    films = (
        await db.execute(
            select(WatchlistFilm).where(WatchlistFilm.watchlist_id == wl.id)
        )
    ).scalars().all()
    by_tmdb = {f.tmdb_id: f for f in films}

    position = 0
    for tmdb_id in body.tmdb_ids:
        f = by_tmdb.pop(tmdb_id, None)
        if f is not None:
            f.position = position
            position += 1
    # Anything the client didn't mention keeps its relative order at the end,
    # so a stale client can't silently drop films from the list.
    for f in sorted(by_tmdb.values(), key=lambda x: x.position):
        f.position = position
        position += 1

    await db.flush()
    return {"ok": True, "count": position}
