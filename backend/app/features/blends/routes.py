"""Blends — two people's taste, one list of films.

A Blend answers "what should we watch together?" by reusing the discovery
engine rather than inventing a second recommendation path (KASET.md §8):

  1. Take each member's highest-rated films as seeds.
  2. Pull the warm evidence pool for those seeds — the same pools the film page
     uses, so a blend recommendation is as evidence-backed as any other.
  3. Keep candidates that surface for **more than one member**; that overlap is
     the blend.
  4. Drop anything any member has already seen — the point is a film for the
     evening, not a reminder of one they've had.

Deliberately simple. SlateClub's Match Cut compared 25-dimensional taste vectors
to compute a compatibility percentage; that stack is gone, and this needs no
model at all.
"""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.features.discovery import pipeline, rank
from app.shared.models.actions import Rating, WatchHistory
from app.shared.models.collections import Blend, BlendMember
from app.shared.models.movie import Movie
from app.shared.models.user import User

router = APIRouter(prefix="/api/blends", tags=["blends"])

#: Seeds per member. Enough to characterise taste, few enough to stay fast.
SEEDS_PER_MEMBER = 4
RESULT_COUNT = 12


class CreateBody(BaseModel):
    title: str = Field("Blend", max_length=80)


async def _blend_or_404(db: AsyncSession, blend_id: str) -> Blend:
    b = (await db.execute(select(Blend).where(Blend.id == blend_id))).scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Blend not found")
    return b


async def _members(db: AsyncSession, blend_id: str) -> list[User]:
    ids = (
        await db.execute(select(BlendMember.user_id).where(BlendMember.blend_id == blend_id))
    ).scalars().all()
    if not ids:
        return []
    return list((await db.execute(select(User).where(User.id.in_(ids)))).scalars().all())


async def _is_member(db: AsyncSession, blend_id: str, user_id: str) -> bool:
    return (
        await db.execute(
            select(BlendMember).where(
                BlendMember.blend_id == blend_id, BlendMember.user_id == user_id
            )
        )
    ).scalar_one_or_none() is not None


def _payload(b: Blend, members: list[User], is_member: bool) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        # The token is the access model, so only members ever see it.
        "inviteToken": b.invite_token if is_member else None,
        "isMember": is_member,
        "members": [
            {"id": u.id, "name": u.name, "username": u.username, "avatarUrl": u.avatar_url}
            for u in members
        ],
        "createdAt": b.created_at.isoformat(),
    }


@router.post("")
async def create(
    body: CreateBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    blend = Blend(creator_id=user.id, title=body.title.strip() or "Blend")
    db.add(blend)
    await db.flush()
    db.add(BlendMember(blend_id=blend.id, user_id=user.id))
    await db.flush()
    return _payload(blend, [user], is_member=True)


@router.get("")
async def mine(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = (
        await db.execute(select(BlendMember.blend_id).where(BlendMember.user_id == user.id))
    ).scalars().all()
    if not ids:
        return []
    blends = (
        await db.execute(
            select(Blend).where(Blend.id.in_(ids)).order_by(Blend.created_at.desc())
        )
    ).scalars().all()
    return [_payload(b, await _members(db, b.id), is_member=True) for b in blends]


@router.post("/join/{invite_token}")
async def join(
    invite_token: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Join by link. The token *is* the access model — anyone holding it is
    meant to be in the blend."""
    blend = (
        await db.execute(select(Blend).where(Blend.invite_token == invite_token))
    ).scalar_one_or_none()
    if not blend:
        raise HTTPException(status_code=404, detail="That invite link isn't valid")

    if not await _is_member(db, blend.id, user.id):
        db.add(BlendMember(blend_id=blend.id, user_id=user.id))
        await db.flush()

    return _payload(blend, await _members(db, blend.id), is_member=True)


@router.get("/{blend_id}")
async def detail(
    blend_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    blend = await _blend_or_404(db, blend_id)
    is_member = await _is_member(db, blend.id, user.id)
    return _payload(blend, await _members(db, blend.id), is_member)


@router.delete("/{blend_id}/leave")
async def leave(
    blend_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(BlendMember).where(
                BlendMember.blend_id == blend_id, BlendMember.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.flush()
    return {"ok": True}


async def _seeds_for(db: AsyncSession, user_id: str) -> list[int]:
    """A member's highest-rated films, as TMDB ids."""
    rows = (
        await db.execute(
            select(Movie.tmdb_id)
            .join(Rating, Rating.movie_id == Movie.id)
            .where(Rating.user_id == user_id, Rating.value >= 4)
            .order_by(Rating.value.desc(), Rating.updated_at.desc())
            .limit(SEEDS_PER_MEMBER)
        )
    ).scalars().all()
    return list(rows)


async def _seen_by(db: AsyncSession, user_ids: list[str]) -> set[int]:
    rows = (
        await db.execute(
            select(Movie.tmdb_id)
            .join(WatchHistory, WatchHistory.movie_id == Movie.id)
            .where(WatchHistory.user_id.in_(user_ids))
        )
    ).scalars().all()
    return set(rows)


@router.get("/{blend_id}/recommendations")
async def recommendations(
    blend_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Films for the whole blend.

    Returns an explicit `reason` when there's nothing to show, because "no
    results" here has several distinct causes and a blank list would hide which.
    """
    blend = await _blend_or_404(db, blend_id)
    if not await _is_member(db, blend.id, user.id):
        raise HTTPException(status_code=403, detail="You're not in this blend")

    members = await _members(db, blend.id)
    if len(members) < 2:
        return {"results": [], "reason": "waiting_for_members", "members": len(members)}

    # Which members each candidate surfaced for — the overlap is the blend.
    supporters: dict[int, set[str]] = defaultdict(set)
    pooled: dict[int, object] = {}

    for member in members:
        for seed_tmdb in await _seeds_for(db, member.id):
            for cand in await pipeline.candidates_from_evidence(db, seed_tmdb):
                supporters[cand.tmdb_id].add(member.id)
                existing = pooled.get(cand.tmdb_id)
                if existing is None:
                    pooled[cand.tmdb_id] = cand
                else:
                    # Same film reached from two seeds: merge the evidence so
                    # its mention count reflects everything that named it.
                    existing.mentions.extend(cand.mentions)

    if not pooled:
        return {"results": [], "reason": "no_warm_pools", "members": len(members)}

    seen = await _seen_by(db, [m.id for m in members])
    shared = [
        c
        for tmdb_id, c in pooled.items()
        if len(supporters[tmdb_id]) > 1 and tmdb_id not in seen
    ]

    if not shared:
        return {"results": [], "reason": "no_overlap", "members": len(members)}

    scored = rank.rank(shared, {"title": blend.title}, lens="community")
    return {
        "reason": None,
        "members": len(members),
        "results": [
            {
                "tmdbId": s.candidate.tmdb_id,
                "title": s.candidate.title,
                "year": s.candidate.year,
                "posterPath": s.candidate.poster_path,
                "score": s.score,
                "sharedBy": len(supporters[s.candidate.tmdb_id]),
                "evidence": [
                    {
                        "sourceName": m.get("source_name"),
                        "context": m.get("context"),
                    }
                    for m in s.candidate.mentions[:3]
                ],
            }
            for s in scored[:RESULT_COUNT]
        ],
    }
