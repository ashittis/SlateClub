from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_optional_user
from app.core.database import get_db
from app.shared.models.actions import (
    CurrentlyWatching,
    DnfEntry,
    Rating,
    Review,
    WatchHistory,
    WatchlistItem,
)
from app.shared.models.movie import Movie
from app.shared.models.onboarding import FavoriteMovie, OnboardingSignals
from app.shared.models.social import Follow
from app.shared.models.user import User, UserPreferences

router = APIRouter(prefix="/api/users", tags=["users"])


# ── Schemas ──────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


class PublicProfile(BaseModel):
    id: str
    name: str
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    ratings_count: int = 0
    watchlist_count: int = 0
    watched_count: int = 0
    reviews_count: int = 0
    followers_count: int = 0
    following_count: int = 0


# ── Routes ───────────────────────────────────────────────────


@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=1, max_length=64),
    limit: int = Query(20, ge=1, le=50),
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fuzzy match against User.name and User.username.
    Excludes the requesting user from results.
    Order: prefix matches on username first, then prefix matches on
    name, then everything else by name length asc (shorter = better).
    """
    needle = q.strip()
    if not needle:
        return {"items": []}
    pattern = f"%{needle}%"
    prefix = f"{needle}%"

    stmt = (
        select(User)
        .where(
            or_(
                User.name.ilike(pattern),
                User.username.ilike(pattern),
            )
        )
        .order_by(
            # Prefix matches first.
            User.username.ilike(prefix).desc(),
            User.name.ilike(prefix).desc(),
            func.length(User.name).asc(),
        )
        .limit(limit)
    )
    if user is not None:
        stmt = stmt.where(User.id != user.id)

    rows = (await db.execute(stmt)).scalars().all()
    return {
        "items": [
            {
                "id": u.id,
                "name": u.name,
                "username": u.username,
                "avatarUrl": u.avatar_url,
                "bio": u.bio,
            }
            for u in rows
        ]
    }


@router.get("/{username}", response_model=PublicProfile)
async def get_profile(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Counts
    ratings_count = (
        await db.execute(select(func.count()).where(Rating.user_id == user.id))
    ).scalar() or 0

    watchlist_count = (
        await db.execute(select(func.count()).where(WatchlistItem.user_id == user.id))
    ).scalar() or 0

    watched_count = (
        await db.execute(select(func.count()).where(WatchHistory.user_id == user.id))
    ).scalar() or 0

    reviews_count = (
        await db.execute(select(func.count()).where(Review.user_id == user.id))
    ).scalar() or 0

    followers_count = (
        await db.execute(select(func.count()).where(Follow.following_id == user.id))
    ).scalar() or 0

    following_count = (
        await db.execute(select(func.count()).where(Follow.follower_id == user.id))
    ).scalar() or 0

    return PublicProfile(
        id=user.id,
        name=user.name,
        username=user.username,
        avatar_url=user.avatar_url,
        bio=user.bio,
        ratings_count=ratings_count,
        watchlist_count=watchlist_count,
        watched_count=watched_count,
        reviews_count=reviews_count,
        followers_count=followers_count,
        following_count=following_count,
    )


@router.get("/me/profile", response_model=PublicProfile)
async def my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Same shape as GET /api/users/{username}, but for the current user.
    Used by the own-profile page header + stats."""
    return await get_profile(user.username, db)


def _movie_payload(m: Movie) -> dict:
    return {
        "id": m.id,
        "tmdbId": m.tmdb_id,
        "mediaType": m.media_type,
        "title": m.title,
        "posterPath": m.poster_path,
        "backdropPath": m.backdrop_path,
        "releaseDate": m.release_date,
        "voteAverage": m.vote_average,
        "originalLanguage": m.original_language,
    }


@router.get("/me/watchlist")
async def my_watchlist(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(WatchlistItem, Movie)
            .join(Movie, WatchlistItem.movie_id == Movie.id)
            .where(WatchlistItem.user_id == user.id)
            .order_by(WatchlistItem.created_at.desc())
        )
    ).all()
    return [
        {
            **_movie_payload(m),
            "reasonType": wl.reason_type,
            "reasonReference": wl.reason_reference,
            "note": wl.note,
            "addedAt": wl.created_at.isoformat(),
        }
        for wl, m in rows
    ]


@router.get("/me/watching")
async def my_watching(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(CurrentlyWatching, Movie)
            .join(Movie, CurrentlyWatching.movie_id == Movie.id)
            .where(CurrentlyWatching.user_id == user.id)
            .order_by(CurrentlyWatching.updated_at.desc())
        )
    ).all()
    return [
        {
            **_movie_payload(m),
            "progressPct": cw.progress_pct,
            "startedAt": cw.started_at.isoformat(),
        }
        for cw, m in rows
    ]


@router.get("/me/dnf")
async def my_dnf(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(DnfEntry, Movie)
            .join(Movie, DnfEntry.movie_id == Movie.id)
            .where(DnfEntry.user_id == user.id)
            .order_by(DnfEntry.created_at.desc())
        )
    ).all()
    return [
        {
            **_movie_payload(m),
            "reason": d.reason,
            "stoppedAt": d.stopped_at,
            "progressPct": d.progress_pct,
        }
        for d, m in rows
    ]


@router.get("/me/watched")
async def my_watched(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(WatchHistory, Movie)
            .join(Movie, WatchHistory.movie_id == Movie.id)
            .where(WatchHistory.user_id == user.id)
            .order_by(WatchHistory.watched_at.desc())
        )
    ).all()
    return [{**_movie_payload(m), "watchedAt": wh.watched_at.isoformat() if wh.watched_at else None} for wh, m in rows]


@router.get("/me/ratings")
async def my_ratings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Rating, Movie)
            .join(Movie, Rating.movie_id == Movie.id)
            .where(Rating.user_id == user.id)
            .order_by(Rating.updated_at.desc())
        )
    ).all()
    return [{**_movie_payload(m), "userRating": r.value, "ratedAt": r.updated_at.isoformat() if r.updated_at else None} for r, m in rows]


@router.get("/me/favorites")
async def my_favorites(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the user's favourite films.

    Self-heals: early users had their onboarding picks stored only as raw
    tmdb ids in OnboardingSignals.poster_picks and never materialised into
    favorite_movies. When favorite_movies is empty but poster_picks exists,
    hydrate those ids (title + poster) and backfill the rows once, preserving
    the picked order.
    """
    rows = (
        await db.execute(
            select(FavoriteMovie)
            .where(FavoriteMovie.user_id == user.id)
            .order_by(FavoriteMovie.created_at.asc())
        )
    ).scalars().all()

    if not rows:
        rows = await _backfill_favorites_from_poster_picks(user.id, db)

    return [
        {"tmdbId": f.tmdb_id, "title": f.title, "posterPath": f.poster_path}
        for f in rows
    ]


async def _backfill_favorites_from_poster_picks(
    user_id: str, db: AsyncSession
) -> list[FavoriteMovie]:
    """Hydrate a user's poster_picks tmdb ids into favorite_movies rows.

    Returns the newly-created rows in pick order (empty list if there are no
    poster_picks). Ids that can't be resolved from TMDB are skipped.
    """
    # Imported lazily to avoid a routes-level import cycle.
    from app.features.movies.movies import _get_or_fetch_movie

    signals = (
        await db.execute(
            select(OnboardingSignals).where(OnboardingSignals.user_id == user_id)
        )
    ).scalar_one_or_none()
    picks = (signals.poster_picks if signals else None) or []
    if not picks:
        return []

    created: list[FavoriteMovie] = []
    for tmdb_id in picks:
        try:
            movie = await _get_or_fetch_movie(int(tmdb_id), db)
        except HTTPException:
            continue  # unknown id — skip rather than fail the whole request
        fav = FavoriteMovie(
            user_id=user_id,
            tmdb_id=movie.tmdb_id,
            title=movie.title,
            poster_path=movie.poster_path,
        )
        db.add(fav)
        created.append(fav)

    if created:
        await db.flush()
    return created


@router.patch("/me")
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Check username uniqueness if changing
    if "username" in update_data:
        existing = await db.execute(
            select(User).where(User.username == update_data["username"], User.id != user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")

    for k, v in update_data.items():
        setattr(user, k, v)

    await db.flush()
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "onboarded": user.onboarded,
    }


# ── Preferences ───────────────────────────────────────────────


class PreferencesUpdate(BaseModel):
    notif_opt_out: list[str] | None = None
    profile_visibility: str | None = None
    twin_matching_enabled: bool | None = None


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
        return {
            "notifOptOut": [],
            "profileVisibility": "public",
            "twinMatchingEnabled": True,
        }
    return {
        "notifOptOut": row.notif_opt_out or [],
        "profileVisibility": row.profile_visibility,
        "twinMatchingEnabled": row.twin_matching_enabled,
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
        await db.flush()

    if body.notif_opt_out is not None:
        row.notif_opt_out = body.notif_opt_out
    if body.profile_visibility is not None:
        if body.profile_visibility not in ("public", "followers", "private"):
            raise HTTPException(status_code=400, detail="invalid visibility")
        row.profile_visibility = body.profile_visibility
    if body.twin_matching_enabled is not None:
        row.twin_matching_enabled = body.twin_matching_enabled

    await db.flush()
    return {
        "notifOptOut": row.notif_opt_out or [],
        "profileVisibility": row.profile_visibility,
        "twinMatchingEnabled": row.twin_matching_enabled,
    }


# ── Twin matching ─────────────────────────────────────────────


async def _user_movie_set(db: AsyncSession, user_id: str) -> set[str]:
    """Combined set of movie_ids the user has rated/shelved/watched."""
    rows = (
        await db.execute(
            select(Rating.movie_id).where(Rating.user_id == user_id)
        )
    ).all()
    out = {r[0] for r in rows}
    rows = (
        await db.execute(
            select(WatchlistItem.movie_id).where(WatchlistItem.user_id == user_id)
        )
    ).all()
    out.update(r[0] for r in rows)
    rows = (
        await db.execute(
            select(WatchHistory.movie_id).where(WatchHistory.user_id == user_id)
        )
    ).all()
    out.update(r[0] for r in rows)
    return out


async def _user_high_rated(db: AsyncSession, user_id: str, threshold: float = 4.0) -> set[str]:
    rows = (
        await db.execute(
            select(Rating.movie_id).where(
                Rating.user_id == user_id, Rating.value >= threshold
            )
        )
    ).all()
    return {r[0] for r in rows}


@router.get("/{username}/twin-score")
async def twin_score(
    username: str,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cheap twin-score against the requesting user.
    Score is the Jaccard of their combined film sets, weighted by the
    fraction that are HIGHLY-rated by both. Floor 0, ceiling 1.
    """
    target = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == me.id:
        return {"score": 1.0, "isSelf": True, "overlapCount": 0}

    a = await _user_movie_set(db, me.id)
    b = await _user_movie_set(db, target.id)

    if not a or not b:
        return {"score": 0.0, "isSelf": False, "overlapCount": 0}

    overlap = a & b
    union = a | b
    jaccard = len(overlap) / len(union) if union else 0.0

    # Weight by high-rating overlap.
    a_hi = await _user_high_rated(db, me.id)
    b_hi = await _user_high_rated(db, target.id)
    hi_overlap = a_hi & b_hi
    hi_boost = min(0.35, len(hi_overlap) / 12.0)

    score = max(0.0, min(1.0, jaccard + hi_boost))

    return {
        "score": round(score, 3),
        "isSelf": False,
        "overlapCount": len(overlap),
        "highRatedOverlap": len(hi_overlap),
    }


@router.get("/{username}/films-youd-both-love")
async def films_youd_both_love(
    username: str,
    limit: int = 12,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Films neither user has logged yet, biased toward the genre overlap
    of the films they've BOTH high-rated. Cheap heuristic — once the
    taste graph is queryable per-pair (P3+) wire that in.
    """
    target = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == me.id:
        return {"items": []}

    a_seen = await _user_movie_set(db, me.id)
    b_seen = await _user_movie_set(db, target.id)
    seen = a_seen | b_seen

    # Source candidates by popularity, exclude what either has logged.
    rows = (
        await db.execute(
            select(Movie)
            .where(Movie.poster_path.is_not(None))
            .order_by(Movie.popularity.desc().nullslast())
            .limit(limit * 4)
        )
    ).scalars().all()
    candidates = [m for m in rows if m.id not in seen][:limit]
    return {
        "items": [
            {
                "tmdbId": m.tmdb_id,
                "title": m.title,
                "posterPath": m.poster_path,
                "releaseDate": m.release_date,
            }
            for m in candidates
        ]
    }


@router.get("/{username}/mutual-twins")
async def mutual_twins(
    username: str,
    limit: int = 8,
    me: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Users that both the requesting user AND the target follow — cheap
    proxy for "shared taste neighbours". Will be replaced with a true
    twin-set intersection from the taste graph in P3.
    """
    target = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == me.id:
        return {"items": []}

    my_following = {
        r[0]
        for r in (
            await db.execute(
                select(Follow.following_id).where(Follow.follower_id == me.id)
            )
        ).all()
    }
    their_following = {
        r[0]
        for r in (
            await db.execute(
                select(Follow.following_id).where(Follow.follower_id == target.id)
            )
        ).all()
    }
    mutual = my_following & their_following
    if not mutual:
        return {"items": []}

    users = (
        await db.execute(
            select(User).where(User.id.in_(list(mutual))).limit(limit)
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": u.id,
                "name": u.name,
                "username": u.username,
                "avatarUrl": u.avatar_url,
            }
            for u in users
        ]
    }


# ── Public per-user library (any profile) ─────────────────────
# Declared after /me/* so "me" still resolves to the literal routes.


async def _user_by_username(db: AsyncSession, username: str) -> User:
    target = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    return target


async def _assert_can_view(db: AsyncSession, viewer: User | None, target: User) -> None:
    """Enforce the target's profile_visibility. `public` → anyone; `followers`
    → the viewer must follow the target; `private` → only the target. Missing
    preferences are treated as public. Raises 403 when the viewer is blocked."""
    if viewer is not None and viewer.id == target.id:
        return
    prefs = (
        await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == target.id)
        )
    ).scalar_one_or_none()
    visibility = prefs.profile_visibility if prefs else "public"
    if visibility == "public":
        return
    if visibility == "followers" and viewer is not None:
        follows = (
            await db.execute(
                select(Follow.id).where(
                    Follow.follower_id == viewer.id, Follow.following_id == target.id
                )
            )
        ).scalar_one_or_none()
        if follows is not None:
            return
    raise HTTPException(status_code=403, detail="This profile is private")


@router.get("/{username}/ratings")
async def user_ratings(
    username: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _user_by_username(db, username)
    await _assert_can_view(db, viewer, target)
    rows = (
        await db.execute(
            select(Rating, Movie)
            .join(Movie, Rating.movie_id == Movie.id)
            .where(Rating.user_id == target.id)
            .order_by(Rating.updated_at.desc())
        )
    ).all()
    return [{**_movie_payload(m), "userRating": r.value} for r, m in rows]


@router.get("/{username}/watchlist")
async def user_watchlist(
    username: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # The shelf (watchlist) is private — only its owner may read it.
    target = await _user_by_username(db, username)
    if target.id != user.id:
        raise HTTPException(status_code=403, detail="This shelf is private")
    rows = (
        await db.execute(
            select(WatchlistItem, Movie)
            .join(Movie, WatchlistItem.movie_id == Movie.id)
            .where(WatchlistItem.user_id == target.id)
            .order_by(WatchlistItem.created_at.desc())
        )
    ).all()
    return [_movie_payload(m) for _, m in rows]


@router.get("/{username}/watching")
async def user_watching(
    username: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _user_by_username(db, username)
    await _assert_can_view(db, viewer, target)
    rows = (
        await db.execute(
            select(CurrentlyWatching, Movie)
            .join(Movie, CurrentlyWatching.movie_id == Movie.id)
            .where(CurrentlyWatching.user_id == target.id)
            .order_by(CurrentlyWatching.updated_at.desc())
        )
    ).all()
    return [
        {
            **_movie_payload(m),
            "progressPct": cw.progress_pct,
            "startedAt": cw.started_at.isoformat(),
        }
        for cw, m in rows
    ]


@router.get("/{username}/dnf")
async def user_dnf(
    username: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _user_by_username(db, username)
    await _assert_can_view(db, viewer, target)
    rows = (
        await db.execute(
            select(DnfEntry, Movie)
            .join(Movie, DnfEntry.movie_id == Movie.id)
            .where(DnfEntry.user_id == target.id)
            .order_by(DnfEntry.created_at.desc())
        )
    ).all()
    return [
        {
            **_movie_payload(m),
            "reason": d.reason,
            "stoppedAt": d.stopped_at,
            "progressPct": d.progress_pct,
        }
        for d, m in rows
    ]
