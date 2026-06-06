"""
Community Posts API

Reddit/X-style posts with optional titles, flat replies, and upvotes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.posts import POST_TYPES, Post, PostReply, PostUpvote
from ..models.social import Follow
from ..models.user import User

router = APIRouter(prefix="/api", tags=["posts"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ── Posts ──────────────────────────────────────────────────────


class PostIn(CamelModel):
    title: str | None = Field(default=None, max_length=300)
    body: str = Field(min_length=1, max_length=5000)
    post_type: str = Field(default="text")
    tmdb_id: int | None = None


@router.post("/posts")
async def create_post(
    body: PostIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.post_type not in POST_TYPES:
        raise HTTPException(status_code=400, detail="invalid post_type")
    post = Post(
        user_id=user.id,
        title=body.title.strip() if body.title else None,
        body=body.body.strip(),
        post_type=body.post_type,
        tmdb_id=body.tmdb_id,
    )
    db.add(post)
    await db.flush()
    return _post_payload(post, user, upvote_count=0, my_upvote=False)


@router.get("/posts")
async def list_posts(
    feed: str = Query("world", pattern="^(world|network)$"),
    tmdb_id: int | None = Query(default=None, alias="tmdbId"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Post, User)
        .join(User, User.id == Post.user_id)
        .order_by(desc(Post.created_at))
        .limit(limit)
        .offset(offset)
    )
    if tmdb_id is not None:
        stmt = stmt.where(Post.tmdb_id == tmdb_id)
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
            return {"items": [], "total": 0}
        stmt = stmt.where(Post.user_id.in_(following))

    rows = (await db.execute(stmt)).all()
    if not rows:
        return {"items": [], "total": 0}

    post_ids = [p.id for p, _ in rows]
    upvote_counts = await _upvote_counts(db, post_ids)
    my_upvotes = await _my_upvotes(db, user, post_ids)

    return {
        "items": [
            _post_payload(
                p,
                u,
                upvote_count=upvote_counts.get(p.id, 0),
                my_upvote=p.id in my_upvotes,
            )
            for p, u in rows
        ]
    }


@router.get("/posts/{post_id}")
async def get_post(
    post_id: str,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(Post, User).join(User, User.id == Post.user_id).where(Post.id == post_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=404)
    post, author = row
    counts = await _upvote_counts(db, [post_id])
    my_upvotes = await _my_upvotes(db, user, [post_id])
    return _post_payload(
        post,
        author,
        upvote_count=counts.get(post_id, 0),
        my_upvote=post_id in my_upvotes,
    )


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = (
        await db.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404)
    if post.user_id != user.id:
        raise HTTPException(status_code=403)
    await db.delete(post)
    return {"ok": True}


# ── Upvotes ────────────────────────────────────────────────────


@router.post("/posts/{post_id}/upvote")
async def toggle_upvote(
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = (
        await db.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404)

    existing = (
        await db.execute(
            select(PostUpvote).where(
                PostUpvote.post_id == post_id, PostUpvote.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        return {"ok": True, "upvoted": False}

    db.add(PostUpvote(post_id=post_id, user_id=user.id))
    return {"ok": True, "upvoted": True}


# ── Replies ────────────────────────────────────────────────────


class ReplyIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.post("/posts/{post_id}/replies")
async def create_reply(
    post_id: str,
    body: ReplyIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = (
        await db.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404)

    reply = PostReply(post_id=post_id, user_id=user.id, body=body.body.strip())
    db.add(reply)
    post.reply_count = (post.reply_count or 0) + 1
    await db.flush()
    return _reply_payload(reply, user)


@router.get("/posts/{post_id}/replies")
async def list_replies(
    post_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PostReply, User)
            .join(User, User.id == PostReply.user_id)
            .where(PostReply.post_id == post_id)
            .order_by(PostReply.created_at)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return {"items": [_reply_payload(r, u) for r, u in rows]}


@router.delete("/posts/{post_id}/replies/{reply_id}")
async def delete_reply(
    post_id: str,
    reply_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reply = (
        await db.execute(
            select(PostReply).where(
                PostReply.id == reply_id, PostReply.post_id == post_id
            )
        )
    ).scalar_one_or_none()
    if reply is None:
        raise HTTPException(status_code=404)
    if reply.user_id != user.id:
        raise HTTPException(status_code=403)

    post = (
        await db.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if post and post.reply_count > 0:
        post.reply_count -= 1

    await db.delete(reply)
    return {"ok": True}


# ── Helpers ────────────────────────────────────────────────────


def _user_brief(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "username": u.username,
        "avatarUrl": u.avatar_url,
    }


def _post_payload(post: Post, author: User, upvote_count: int, my_upvote: bool) -> dict:
    return {
        "id": post.id,
        "title": post.title,
        "body": post.body,
        "postType": post.post_type,
        "tmdbId": post.tmdb_id,
        "replyCount": post.reply_count,
        "upvoteCount": upvote_count,
        "myUpvote": my_upvote,
        "createdAt": post.created_at.isoformat(),
        "user": _user_brief(author),
    }


def _reply_payload(reply: PostReply, author: User) -> dict:
    return {
        "id": reply.id,
        "postId": reply.post_id,
        "body": reply.body,
        "createdAt": reply.created_at.isoformat(),
        "user": _user_brief(author),
    }


async def _upvote_counts(db: AsyncSession, post_ids: list[str]) -> dict[str, int]:
    if not post_ids:
        return {}
    rows = (
        await db.execute(
            select(PostUpvote.post_id, func.count())
            .where(PostUpvote.post_id.in_(post_ids))
            .group_by(PostUpvote.post_id)
        )
    ).all()
    return {pid: count for pid, count in rows}


async def _my_upvotes(db: AsyncSession, user: User | None, post_ids: list[str]) -> set[str]:
    if user is None or not post_ids:
        return set()
    rows = (
        await db.execute(
            select(PostUpvote.post_id)
            .where(PostUpvote.user_id == user.id)
            .where(PostUpvote.post_id.in_(post_ids))
        )
    ).all()
    return {r[0] for r in rows}
