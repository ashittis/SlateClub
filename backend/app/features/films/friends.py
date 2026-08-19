"""Who among the people you follow has seen this film.

Kept out of `routes.py` because the query has real shape to it — three tables
and a de-duplication pass — and route files in this repo stay thin.

The privacy rule is the one thing here that must not be got wrong: a viewing
marked private is invisible to everyone but its author, always. That is enforced
in the query rather than filtered afterwards, so there is no path where a
private row is loaded and then relied upon to be dropped later.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.actions import DiaryEntry, Rating
from app.shared.models.social import Follow
from app.shared.models.user import User


async def friends_who_watched(
    movie_id: str,
    viewer: User,
    db: AsyncSession,
    limit: int = 12,
) -> dict:
    """The people `viewer` follows who have publicly logged `movie_id`.

    One row per person — their most recent viewing — newest first. The rating
    reported is the diary entry's own, falling back to their standing rating for
    the film, because those are different things: an entry records what you
    thought that night, the Rating row is what you think now. Either is more
    honest than showing nothing.
    """
    following_ids = (
        await db.execute(select(Follow.following_id).where(Follow.follower_id == viewer.id))
    ).scalars().all()
    if not following_ids:
        return {"friends": [], "total": 0}

    entries = (
        await db.execute(
            select(DiaryEntry)
            .where(
                DiaryEntry.movie_id == movie_id,
                DiaryEntry.user_id.in_(following_ids),
                DiaryEntry.visibility == "public",
            )
            .order_by(DiaryEntry.watched_on.desc(), DiaryEntry.created_at.desc())
        )
    ).scalars().all()
    if not entries:
        return {"friends": [], "total": 0}

    # Most recent viewing per person. Already ordered, so first wins — someone
    # who has seen a film four times should appear once, not four times.
    latest: dict[str, DiaryEntry] = {}
    for e in entries:
        latest.setdefault(e.user_id, e)

    user_ids = list(latest)

    users = (
        await db.execute(select(User).where(User.id.in_(user_ids)))
    ).scalars().all()
    by_id = {u.id: u for u in users}

    standing = {
        r.user_id: r.value
        for r in (
            await db.execute(
                select(Rating).where(
                    Rating.movie_id == movie_id, Rating.user_id.in_(user_ids)
                )
            )
        ).scalars().all()
    }

    friends = []
    for uid in user_ids[:limit]:
        u = by_id.get(uid)
        if u is None:
            continue
        entry = latest[uid]
        friends.append(
            {
                "id": u.id,
                "name": u.name,
                "username": u.username,
                "avatar_url": u.avatar_url,
                "rating": entry.rating if entry.rating is not None else standing.get(uid),
                "liked": entry.liked,
                "watchedOn": entry.watched_on.isoformat(),
            }
        )

    # `total` counts everyone, not just the page — "6 watched" should stay true
    # when only four avatars fit.
    return {"friends": friends, "total": len(user_ids)}
