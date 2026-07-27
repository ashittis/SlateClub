from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.actions import Comment, Review
from app.shared.models.user import User

router = APIRouter(prefix="/api/comments", tags=["comments"])


# ── Schemas ──────────────────────────────────────────────────

class CommentCreate(BaseModel):
    review_id: str
    body: str


class CommentResponse(BaseModel):
    id: str
    user_id: str
    review_id: str
    body: str
    user: dict | None = None

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────

@router.post("/", response_model=CommentResponse)
async def add_comment(
    body: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify review exists
    result = await db.execute(select(Review).where(Review.id == body.review_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Review not found")

    comment = Comment(user_id=user.id, review_id=body.review_id, body=body.body)
    db.add(comment)
    await db.flush()

    return CommentResponse(
        id=comment.id,
        user_id=comment.user_id,
        review_id=comment.review_id,
        body=comment.body,
        user={"id": user.id, "name": user.name, "username": user.username, "avatar_url": user.avatar_url},
    )


@router.get("/{review_id}", response_model=list[CommentResponse])
async def get_comments(
    review_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment, User)
        .join(User, Comment.user_id == User.id)
        .where(Comment.review_id == review_id)
        .order_by(Comment.created_at.asc())
    )
    rows = result.all()
    return [
        CommentResponse(
            id=c.id,
            user_id=c.user_id,
            review_id=c.review_id,
            body=c.body,
            user={"id": u.id, "name": u.name, "username": u.username, "avatar_url": u.avatar_url},
        )
        for c, u in rows
    ]


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your comment")

    await db.delete(comment)
    await db.flush()
    return {"ok": True}
