"""The Kaset Passport — a user's cinematic identity.

The profile, reconceived. It shows who someone is *as a viewer*: what they've
watched, what they love, what they've written, and how that looks over a month
or a year (KASET.md §8).

Two viewers, one shape: `/me` and `/{username}` return the same payload, so the
client renders one component either way. What differs is privacy — a viewer who
isn't the owner never sees private viewings, and the stats are computed to match.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_optional_user
from app.core.database import get_db
from app.features.passport import stats
from app.shared.models.actions import DiaryEntry, Review, WatchlistItem
from app.shared.models.movie import Movie
from app.shared.models.onboarding import FavoriteMovie, FavoritePerson
from app.shared.models.social import Follow
from app.shared.models.user import User, UserPreferences
from app.shared.services.films import film_payload

router = APIRouter(prefix="/api/passport", tags=["passport"])


class ProfileUpdate(BaseModel):
    name: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    city: str | None = None
    country: str | None = None


async def _by_username(db: AsyncSession, username: str) -> User:
    user = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No such passport")
    return user


async def _assert_visible(db: AsyncSession, viewer: User | None, target: User) -> bool:
    """Returns whether the viewer owns this passport. Raises if it's private
    to them."""
    if viewer and viewer.id == target.id:
        return True

    prefs = (
        await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == target.id)
        )
    ).scalar_one_or_none()
    visibility = prefs.profile_visibility if prefs else "public"

    if visibility == "public":
        return False
    if visibility == "private":
        raise HTTPException(status_code=403, detail="This passport is private")
    if visibility == "followers":
        if not viewer:
            raise HTTPException(status_code=403, detail="This passport is private")
        follows = (
            await db.execute(
                select(Follow).where(
                    Follow.follower_id == viewer.id, Follow.following_id == target.id
                )
            )
        ).scalar_one_or_none()
        if not follows:
            raise HTTPException(status_code=403, detail="This passport is private")
    return False


async def _passport(db: AsyncSession, target: User, is_owner: bool) -> dict:
    """The full passport payload, identical in shape for self and others."""
    summary = await stats.summary(db, target.id, viewer_is_owner=is_owner)
    library = await stats.counts(db, target.id)

    followers = int(
        (
            await db.execute(
                select(func.count()).select_from(Follow).where(Follow.following_id == target.id)
            )
        ).scalar_one()
        or 0
    )
    following = int(
        (
            await db.execute(
                select(func.count()).select_from(Follow).where(Follow.follower_id == target.id)
            )
        ).scalar_one()
        or 0
    )

    favourite_films = (
        await db.execute(
            select(FavoriteMovie)
            .where(FavoriteMovie.user_id == target.id)
            .order_by(FavoriteMovie.position, FavoriteMovie.created_at)
        )
    ).scalars().all()

    favourite_people = (
        await db.execute(
            select(FavoritePerson)
            .where(FavoritePerson.user_id == target.id)
            .order_by(FavoritePerson.position, FavoritePerson.created_at)
        )
    ).scalars().all()

    return {
        "id": target.id,
        "name": target.name,
        "username": target.username,
        "avatarUrl": target.avatar_url,
        "bio": target.bio,
        "city": target.city,
        "country": target.country,
        "joinedAt": target.created_at.isoformat(),
        "isOwner": is_owner,
        "stats": {**summary, **library, "followers": followers, "following": following},
        "favouriteFilms": [
            {"tmdbId": f.tmdb_id, "title": f.title, "posterPath": f.poster_path}
            for f in favourite_films
        ],
        "favouritePeople": [
            {
                "tmdbId": p.tmdb_id,
                "name": p.name,
                "profilePath": p.profile_path,
                "knownFor": p.known_for,
            }
            for p in favourite_people
        ],
        "years": await stats.active_years(db, target.id, viewer_is_owner=is_owner),
    }


@router.get("/me")
async def my_passport(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _passport(db, user, is_owner=True)


@router.patch("/me")
async def update_my_passport(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.username and body.username != user.username:
        taken = (
            await db.execute(select(User).where(User.username == body.username))
        ).scalar_one_or_none()
        if taken:
            raise HTTPException(status_code=409, detail="That username is taken")
        user.username = body.username
    for field in ("name", "avatar_url", "bio", "city", "country"):
        value = getattr(body, field)
        if value is not None:
            setattr(user, field, value)
    await db.flush()
    return await _passport(db, user, is_owner=True)


@router.get("/{username}")
async def passport(
    username: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _by_username(db, username)
    is_owner = await _assert_visible(db, viewer, target)
    return await _passport(db, target, is_owner=is_owner)


@router.get("/{username}/stats")
async def passport_stats(
    username: str,
    period: str = Query("all", pattern="^(all|year|month)$"),
    year: int | None = None,
    month: int | None = Query(None, ge=1, le=12),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Stats for a window — the basis of monthly and yearly Passport sharing."""
    target = await _by_username(db, username)
    is_owner = await _assert_visible(db, viewer, target)

    if period != "all" and year is None:
        year = date.today().year
    if period == "month" and month is None:
        month = date.today().month

    bounds = stats._period_bounds(period, year, month)
    return {
        **await stats.summary(
            db, target.id, viewer_is_owner=is_owner, period=period, year=year, month=month
        ),
        "topPeople": await stats.top_people(
            db, target.id, viewer_is_owner=is_owner, bounds=bounds
        ),
        "topFilms": await stats.top_films(
            db, target.id, viewer_is_owner=is_owner, bounds=bounds
        ),
    }


@router.get("/{username}/diary")
async def passport_diary(
    username: str,
    limit: int = Query(24, ge=1, le=100),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Recent viewings — private ones only when the owner is looking."""
    target = await _by_username(db, username)
    is_owner = await _assert_visible(db, viewer, target)

    stmt = (
        select(DiaryEntry, Movie)
        .join(Movie, DiaryEntry.movie_id == Movie.id)
        .where(DiaryEntry.user_id == target.id)
        .order_by(DiaryEntry.watched_on.desc(), DiaryEntry.created_at.desc())
        .limit(limit)
    )
    if not is_owner:
        stmt = stmt.where(DiaryEntry.visibility == "public")

    return [
        {
            **film_payload(movie),
            "entryId": entry.id,
            "watchedOn": entry.watched_on.isoformat(),
            "rating": entry.rating,
            "isRewatch": entry.is_rewatch,
            "watchType": entry.watch_type,
        }
        for entry, movie in (await db.execute(stmt)).all()
    ]


@router.get("/{username}/reviews")
async def passport_reviews(
    username: str,
    limit: int = Query(20, ge=1, le=100),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _by_username(db, username)
    await _assert_visible(db, viewer, target)

    rows = (
        await db.execute(
            select(Review, Movie)
            .join(Movie, Review.movie_id == Movie.id)
            .where(Review.user_id == target.id)
            .order_by(Review.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        {
            **film_payload(movie),
            "reviewId": review.id,
            "body": review.body,
            "spoiler": review.spoiler,
            "createdAt": review.created_at.isoformat(),
        }
        for review, movie in rows
    ]


@router.get("/{username}/watchlist")
async def passport_watchlist(
    username: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _by_username(db, username)
    await _assert_visible(db, viewer, target)

    rows = (
        await db.execute(
            select(WatchlistItem, Movie)
            .join(Movie, WatchlistItem.movie_id == Movie.id)
            .where(WatchlistItem.user_id == target.id)
            .order_by(WatchlistItem.created_at.desc())
        )
    ).all()
    return [film_payload(m) for _w, m in rows]
