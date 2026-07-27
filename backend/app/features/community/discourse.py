"""
Discourse API — Phase 2.2

Hot Takes (≤280 char), Polls, and per-review Agree/Disagree votes.
The film-detail Discuss tab and the Community feed both consume these.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import Review
from app.features.community.models.discourse import (
    REACTION_KINDS,
    REVIEW_VOTE_KINDS,
    HotTake,
    HotTakeReaction,
    Poll,
    PollVote,
    ReviewVote,
)
from app.shared.models.social import Follow
from app.shared.models.user import User

router = APIRouter(prefix="/api", tags=["discourse"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ── Hot Takes ─────────────────────────────────────────────────


class HotTakeIn(CamelModel):
    body: str = Field(min_length=1, max_length=280)
    tmdb_id: int | None = None


@router.post("/hot-takes")
async def create_hot_take(
    body: HotTakeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    take = HotTake(user_id=user.id, body=body.body.strip(), tmdb_id=body.tmdb_id)
    db.add(take)
    await db.flush()
    return {
        "id": take.id,
        "body": take.body,
        "tmdbId": take.tmdb_id,
        "createdAt": take.created_at.isoformat(),
        "user": _user_brief(user),
        "counts": {"like": 0, "agree": 0, "disagree": 0},
        "myReaction": None,
    }


@router.get("/hot-takes")
async def list_hot_takes(
    feed: str = Query("world", pattern="^(world|network)$"),
    tmdb_id: int | None = Query(default=None, alias="tmdbId"),
    limit: int = Query(30, ge=1, le=100),
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(HotTake, User)
        .join(User, User.id == HotTake.user_id)
        .order_by(desc(HotTake.created_at))
        .limit(limit)
    )
    if tmdb_id is not None:
        stmt = stmt.where(HotTake.tmdb_id == tmdb_id)
    if feed == "network":
        if not user:
            raise HTTPException(status_code=401)
        following = {
            r[0]
            for r in (
                await db.execute(
                    select(Follow.following_id).where(Follow.follower_id == user.id)
                )
            ).all()
        }
        if not following:
            return {"items": []}
        stmt = stmt.where(HotTake.user_id.in_(following))

    rows = (await db.execute(stmt)).all()
    if not rows:
        return {"items": []}

    take_ids = [t.id for t, _ in rows]
    counts = await _reaction_counts(db, take_ids)
    my_reactions = await _my_reactions(db, user, take_ids)

    return {
        "items": [
            {
                "id": t.id,
                "body": t.body,
                "tmdbId": t.tmdb_id,
                "createdAt": t.created_at.isoformat(),
                "user": _user_brief(u),
                "counts": counts.get(t.id, {"like": 0, "agree": 0, "disagree": 0}),
                "myReaction": my_reactions.get(t.id),
            }
            for t, u in rows
        ]
    }


@router.delete("/hot-takes/{take_id}")
async def delete_hot_take(
    take_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    take = (
        await db.execute(select(HotTake).where(HotTake.id == take_id))
    ).scalar_one_or_none()
    if take is None:
        raise HTTPException(status_code=404, detail="Hot take not found")
    if take.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.delete(take)
    return {"ok": True}


class ReactionIn(BaseModel):
    kind: str  # like | agree | disagree


@router.post("/hot-takes/{take_id}/react")
async def react_hot_take(
    take_id: str,
    body: ReactionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.kind not in REACTION_KINDS:
        raise HTTPException(status_code=400, detail="invalid kind")
    take = (
        await db.execute(select(HotTake).where(HotTake.id == take_id))
    ).scalar_one_or_none()
    if take is None:
        raise HTTPException(status_code=404)

    existing = (
        await db.execute(
            select(HotTakeReaction).where(
                HotTakeReaction.hot_take_id == take_id,
                HotTakeReaction.user_id == user.id,
                HotTakeReaction.kind == body.kind,
            )
        )
    ).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        return {"ok": True, "active": False}

    # Agree/disagree are mutually exclusive — if user is toggling one, drop the other.
    if body.kind in ("agree", "disagree"):
        opposite = "disagree" if body.kind == "agree" else "agree"
        opp = (
            await db.execute(
                select(HotTakeReaction).where(
                    HotTakeReaction.hot_take_id == take_id,
                    HotTakeReaction.user_id == user.id,
                    HotTakeReaction.kind == opposite,
                )
            )
        ).scalar_one_or_none()
        if opp:
            await db.delete(opp)

    db.add(
        HotTakeReaction(hot_take_id=take_id, user_id=user.id, kind=body.kind)
    )
    return {"ok": True, "active": True}


async def _reaction_counts(
    db: AsyncSession, take_ids: list[str]
) -> dict[str, dict[str, int]]:
    if not take_ids:
        return {}
    rows = (
        await db.execute(
            select(
                HotTakeReaction.hot_take_id,
                HotTakeReaction.kind,
                func.count(),
            )
            .where(HotTakeReaction.hot_take_id.in_(take_ids))
            .group_by(HotTakeReaction.hot_take_id, HotTakeReaction.kind)
        )
    ).all()
    out: dict[str, dict[str, int]] = {}
    for tid, kind, c in rows:
        out.setdefault(tid, {"like": 0, "agree": 0, "disagree": 0})[kind] = c
    return out


async def _my_reactions(
    db: AsyncSession, user: User | None, take_ids: list[str]
) -> dict[str, str]:
    if user is None or not take_ids:
        return {}
    rows = (
        await db.execute(
            select(HotTakeReaction.hot_take_id, HotTakeReaction.kind)
            .where(HotTakeReaction.user_id == user.id)
            .where(HotTakeReaction.hot_take_id.in_(take_ids))
        )
    ).all()
    out: dict[str, str] = {}
    for tid, kind in rows:
        if tid not in out or kind in ("agree", "disagree"):
            out[tid] = kind
    return out


def _user_brief(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "username": u.username,
        "avatarUrl": u.avatar_url,
    }


# ── Polls ─────────────────────────────────────────────────────


class PollIn(CamelModel):
    question: str
    options: list[str]
    tmdb_id: int | None = None
    closes_in_hours: int | None = Field(default=None, alias="closesInHours")


@router.post("/polls")
async def create_poll(
    body: PollIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    options = [o.strip() for o in body.options if o.strip()]
    if len(options) < 2 or len(options) > 6:
        raise HTTPException(status_code=400, detail="2–6 options")
    closes_at = (
        datetime.now(timezone.utc) + timedelta(hours=body.closes_in_hours)
        if body.closes_in_hours
        else None
    )
    poll = Poll(
        creator_id=user.id,
        question=body.question.strip(),
        options=options,
        tmdb_id=body.tmdb_id,
        closes_at=closes_at,
    )
    db.add(poll)
    await db.flush()
    return await _poll_payload(db, poll, user)


@router.get("/polls")
async def list_polls(
    tmdb_id: int | None = Query(default=None, alias="tmdbId"),
    limit: int = Query(20, ge=1, le=100),
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Poll).order_by(desc(Poll.created_at)).limit(limit)
    if tmdb_id is not None:
        stmt = stmt.where(Poll.tmdb_id == tmdb_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {"items": [await _poll_payload(db, p, user) for p in rows]}


class PollVoteIn(BaseModel):
    option_index: int = Field(ge=0, le=5)


@router.post("/polls/{poll_id}/vote")
async def vote_poll(
    poll_id: str,
    body: PollVoteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    poll = (
        await db.execute(select(Poll).where(Poll.id == poll_id))
    ).scalar_one_or_none()
    if poll is None:
        raise HTTPException(status_code=404)
    if body.option_index >= len(poll.options):
        raise HTTPException(status_code=400, detail="option out of range")
    if poll.closes_at and poll.closes_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="poll closed")

    existing = (
        await db.execute(
            select(PollVote).where(
                PollVote.poll_id == poll_id, PollVote.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.option_index = body.option_index
    else:
        db.add(
            PollVote(
                poll_id=poll_id,
                user_id=user.id,
                option_index=body.option_index,
            )
        )
    await db.flush()
    return await _poll_payload(db, poll, user)


async def _poll_payload(db: AsyncSession, poll: Poll, user: User | None) -> dict:
    rows = (
        await db.execute(
            select(PollVote.option_index, func.count())
            .where(PollVote.poll_id == poll.id)
            .group_by(PollVote.option_index)
        )
    ).all()
    counts = [0] * len(poll.options)
    for idx, c in rows:
        if 0 <= idx < len(counts):
            counts[idx] = c
    my_vote: int | None = None
    if user is not None:
        row = (
            await db.execute(
                select(PollVote.option_index).where(
                    PollVote.poll_id == poll.id, PollVote.user_id == user.id
                )
            )
        ).first()
        my_vote = row[0] if row else None
    return {
        "id": poll.id,
        "question": poll.question,
        "options": poll.options,
        "tmdbId": poll.tmdb_id,
        "closesAt": poll.closes_at and poll.closes_at.isoformat(),
        "createdAt": poll.created_at.isoformat(),
        "creatorId": poll.creator_id,
        "counts": counts,
        "totalVotes": sum(counts),
        "myVote": my_vote,
    }


# ── Review Agree/Disagree votes ──────────────────────────────


class ReviewVoteIn(BaseModel):
    kind: str  # agree | disagree


@router.post("/reviews/{review_id}/vote")
async def vote_review(
    review_id: str,
    body: ReviewVoteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.kind not in REVIEW_VOTE_KINDS:
        raise HTTPException(status_code=400, detail="invalid kind")
    review = (
        await db.execute(select(Review).where(Review.id == review_id))
    ).scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=404)

    existing = (
        await db.execute(
            select(ReviewVote).where(
                ReviewVote.review_id == review_id, ReviewVote.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        if existing.kind == body.kind:
            await db.delete(existing)
            return {"ok": True, "active": False}
        existing.kind = body.kind
    else:
        db.add(
            ReviewVote(review_id=review_id, user_id=user.id, kind=body.kind)
        )
    await db.flush()
    return {"ok": True, "active": True}


@router.get("/reviews/{review_id}/votes")
async def get_review_votes(
    review_id: str,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(ReviewVote.kind, func.count())
            .where(ReviewVote.review_id == review_id)
            .group_by(ReviewVote.kind)
        )
    ).all()
    counts = {"agree": 0, "disagree": 0}
    for kind, c in rows:
        if kind in counts:
            counts[kind] = c
    my = None
    if user is not None:
        row = (
            await db.execute(
                select(ReviewVote.kind).where(
                    ReviewVote.review_id == review_id,
                    ReviewVote.user_id == user.id,
                )
            )
        ).first()
        my = row[0] if row else None
    return {"counts": counts, "myVote": my}
