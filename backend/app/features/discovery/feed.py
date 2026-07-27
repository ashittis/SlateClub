"""
Feed API — Phase 1.4
Powers the redesigned Home: hero card stack and the "Twins Right Now"
sidebar/rail. Both endpoints reuse data already produced elsewhere
(recommendation pipeline, taste graph) — this router stitches them
into the shapes the redesigned Home expects.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.services import geo
from app.shared.models.actions import DiaryEntry, Rating, Review, WatchHistory, WatchlistItem
from app.shared.models.movie import Movie
from app.shared.models.onboarding import FavoriteMovie
from app.shared.models.social import MicroFeedback
from app.shared.models.user import User
from app.ml.embeddings.taste_vector import rating_signal
from app.shared.services.impressions import log_impressions
from app.features.recommendation.recommendations import (
    _movie_to_dict,
    get_pipeline,
    hydrate_catalog_for_languages,
    load_user_priors,
)

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("/hero")
async def hero_feed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns 1 featured film + up to 3 stack-behind films for the
    fanned poster carousel. Delegates to the recommendation pipeline
    so the hero respects onboarding signals (language, mood, etc).
    Falls back to popularity if the pipeline yields nothing (cold DB).
    """
    pipeline = get_pipeline()

    # Build interaction list (cheap — same shape as for_you).
    ratings = (
        await db.execute(
            select(Rating, Movie)
            .join(Movie, Rating.movie_id == Movie.id)
            .where(Rating.user_id == user.id)
        )
    ).all()
    watchlist = (
        await db.execute(
            select(WatchlistItem, Movie)
            .join(Movie, WatchlistItem.movie_id == Movie.id)
            .where(WatchlistItem.user_id == user.id)
        )
    ).all()
    fav_movies = (
        await db.execute(
            select(FavoriteMovie).where(FavoriteMovie.user_id == user.id)
        )
    ).scalars().all()

    interactions: list[dict] = []
    for r, m in ratings:
        bucket = rating_signal(r.value)
        interactions.append(
            {
                "movie_data": _movie_to_dict(m),
                "signal_type": bucket,
                "created_at": r.created_at,
            }
        )
    for wl, m in watchlist:
        interactions.append(
            {
                "movie_data": _movie_to_dict(m),
                "signal_type": "watchlisted",
                "created_at": wl.created_at,
            }
        )
    for fav in fav_movies:
        interactions.append(
            {
                "movie_data": {
                    "id": f"fav_{fav.tmdb_id}",
                    "genres": [],
                    "vote_average": 8.0,
                    "popularity": 100,
                    "runtime": 120,
                    "release_date": "",
                    "original_language": "en",
                },
                "signal_type": "favorite",
                "created_at": fav.created_at,
            }
        )

    # Load priors first so the hydrator knows which languages to pull.
    user_priors = await load_user_priors(user.id, db)
    try:
        added = await hydrate_catalog_for_languages(
            user_priors.get("languages") or [], db
        )
        if added:
            print(f"[hero] hydrated {added} films for user={user.id}")
    except Exception as exc:
        print(f"[hero] hydrate failed: {exc}")

    all_movies = [
        _movie_to_dict(m)
        for m in (await db.execute(select(Movie))).scalars().all()
    ]
    watched_ids = {
        r[0]
        for r in (
            await db.execute(
                select(WatchHistory.movie_id).where(WatchHistory.user_id == user.id)
            )
        ).all()
    }
    # MicroFeedback feeds both the dismissal filter and the negative-signal
    # path on the taste vector.
    feedback_rows = (
        await db.execute(
            select(MicroFeedback, Movie)
            .join(Movie, MicroFeedback.movie_id == Movie.id)
            .where(MicroFeedback.user_id == user.id)
        )
    ).all()
    dismissed_ids: set[str] = set()
    for fb, movie in feedback_rows:
        # Both "not_for_me" and the hero "Dislike" (not_in_mood) should pull
        # the film out of the next pick so the card advances on every action.
        if fb.type in ("not_for_me", "not_in_mood"):
            dismissed_ids.add(fb.movie_id)
        interactions.append({
            "movie_data": _movie_to_dict(movie),
            "signal_type": fb.type,
            "created_at": fb.created_at,
        })

    # Shelving a film ("+ Shelf") should also advance the hero — exclude
    # anything already on the user's watchlist from the candidate set.
    watchlist_ids = {wl.movie_id for wl, _ in watchlist}

    ranked = pipeline.run(
        user_id=user.id,
        user_interactions=interactions,
        all_movies=all_movies,
        watched_ids=watched_ids,
        dismissed_ids=dismissed_ids | watchlist_ids,
        session_mood=None,
        n_results=4,
        user_priors=user_priors,
    )

    if not ranked:
        # Cold cache fallback — keep the hero feed populated. Must honour the
        # same exclusions as the pipeline, otherwise acting on a film re-serves
        # it as the top pick and the hero card never advances.
        excluded = watched_ids | dismissed_ids | watchlist_ids
        conditions = [Movie.poster_path.is_not(None)]
        if excluded:
            conditions.append(Movie.id.not_in(excluded))
        rows = (
            await db.execute(
                select(Movie)
                .where(*conditions)
                .order_by(desc(Movie.popularity).nullslast())
                .limit(4)
            )
        ).scalars().all()
        if not rows:
            return {"hero": None, "stack": [], "explanation": None}
        try:
            await log_impressions(
                db,
                user_id=user.id,
                items=[{"id": r.id} for r in rows],
                default_surface="hero_fallback",
            )
        except Exception as exc:
            print(f"[hero] impression logging (fallback) failed: {exc}")
        return _hero_payload_from_models(rows)

    try:
        await log_impressions(
            db, user_id=user.id, items=ranked, default_surface="hero"
        )
    except Exception as exc:
        print(f"[hero] impression logging failed: {exc}")

    hero, *stack = ranked
    explanation = hero.get("_explanation") or "Picked for you"
    return {
        "hero": {
            "tmdbId": hero.get("tmdb_id"),
            "title": hero.get("title"),
            "posterPath": hero.get("poster_path"),
            "backdropPath": hero.get("backdrop_path"),
            "releaseDate": hero.get("release_date"),
            "voteAverage": hero.get("vote_average"),
            "originalLanguage": hero.get("original_language"),
            "runtime": hero.get("runtime"),
            "genres": hero.get("genres"),
        },
        "stack": [
            {
                "tmdbId": m.get("tmdb_id"),
                "title": m.get("title"),
                "posterPath": m.get("poster_path"),
            }
            for m in stack
        ],
        "explanation": explanation,
    }


def _hero_payload_from_models(rows: list[Movie]) -> dict:
    hero, *stack = rows
    return {
        "hero": {
            "tmdbId": hero.tmdb_id,
            "title": hero.title,
            "posterPath": hero.poster_path,
            "backdropPath": hero.backdrop_path,
            "releaseDate": hero.release_date,
            "voteAverage": hero.vote_average,
            "originalLanguage": hero.original_language,
            "runtime": hero.runtime,
            "genres": hero.genres,
        },
        "stack": [
            {
                "tmdbId": m.tmdb_id,
                "title": m.title,
                "posterPath": m.poster_path,
            }
            for m in stack
        ],
        "explanation": "Trending in the catalog.",
    }


@router.get("/twins-now")
async def twins_now(
    limit: int = Query(8, ge=1, le=20),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    "Twins" = people who share recent taste overlap with you. We surface
    films that *someone else* watched, rated, or reviewed in the recent
    past where *you* also watched, rated, or reviewed the same film. Each
    item names the other person (the twin) and the film you have in common.
    """
    since = datetime.now(timezone.utc) - timedelta(days=90)

    # 1. The films you've touched recently (any signal counts).
    my_movie_ids: set[str] = set()
    for table, ts_col in (
        (WatchHistory, WatchHistory.watched_at),
        (Rating, Rating.created_at),
        (Review, Review.created_at),
    ):
        ids = (
            await db.execute(
                select(table.movie_id).where(
                    table.user_id == user.id, ts_col >= since
                )
            )
        ).scalars().all()
        my_movie_ids.update(ids)

    if not my_movie_ids:
        return {"items": []}

    # 2. Other people's recent activity on those same films. Watches come from
    #    the diary, public-only — naming who watched a private viewing would leak.
    rows: list[tuple[datetime, Movie, User]] = []
    for table, ts_col in (
        (DiaryEntry, DiaryEntry.watched_at),
        (Rating, Rating.created_at),
        (Review, Review.created_at),
    ):
        stmt = (
            select(ts_col, Movie, User)
            .join(Movie, table.movie_id == Movie.id)
            .join(User, table.user_id == User.id)
            .where(
                table.movie_id.in_(my_movie_ids),
                table.user_id != user.id,
                ts_col >= since,
            )
            .order_by(ts_col.desc())
            .limit(limit)
        )
        if table is DiaryEntry:
            stmt = stmt.where(DiaryEntry.visibility == "public")
        result = (await db.execute(stmt)).all()
        rows.extend((ts, m, u) for ts, m, u in result)

    # 3. Most recent first, deduped per (film, twin), capped at limit.
    rows.sort(key=lambda r: r[0], reverse=True)
    seen: set[tuple[str, str]] = set()
    items = []
    for ts, m, u in rows:
        key = (m.tmdb_id, u.username)
        if key in seen:
            continue
        seen.add(key)
        items.append(
            {
                "tmdbId": m.tmdb_id,
                "title": m.title,
                "posterPath": m.poster_path,
                "watchedBy": {
                    "username": u.username,
                    "name": u.name,
                    "avatarUrl": u.avatar_url,
                },
                "watchedAt": ts.isoformat(),
            }
        )
        if len(items) >= limit:
            break

    return {"items": items}


@router.get("/city-trending")
async def city_trending(
    request: Request,
    limit: int = Query(6, ge=1, le=12),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    "Trending in your city" — films most-watched/rated recently by users whose
    IP-resolved city matches the caller's. The caller's city is derived from
    the request IP (localhost falls back to the server's public IP) and cached
    onto their user row so it becomes part of the aggregation pool.

    Returns ``resolved: false`` (and no items) when the IP can't be placed, so
    the client can show its "coming soon" empty state.
    """
    place = await geo.resolve_city(geo.client_ip(request))

    if place is None:
        return {"resolved": False, "city": None, "items": []}

    # Cache the freshest read onto the user so their activity counts toward
    # their own city's trend and repeat visits stay consistent.
    user.city = place["city"]
    user.region = place["region"]
    user.country = place["country"]
    user.geo_updated_at = datetime.now(timezone.utc)
    await db.flush()

    since = datetime.now(timezone.utc) - timedelta(days=30)

    # Rank films by distinct viewers in this city across watches + ratings.
    # Watches come from the diary, public-only, so private viewings don't feed
    # a public trend.
    counts: dict[str, dict] = {}
    for table, ts_col in (
        (DiaryEntry, DiaryEntry.watched_at),
        (Rating, Rating.created_at),
    ):
        stmt = (
            select(Movie, func.count(func.distinct(table.user_id)))
            .join(Movie, table.movie_id == Movie.id)
            .join(User, table.user_id == User.id)
            .where(User.city == place["city"], ts_col >= since)
            .group_by(Movie.id)
        )
        if table is DiaryEntry:
            stmt = stmt.where(DiaryEntry.visibility == "public")
        rows = (await db.execute(stmt)).all()
        for movie, viewers in rows:
            entry = counts.setdefault(
                movie.id,
                {
                    "tmdbId": movie.tmdb_id,
                    "title": movie.title,
                    "posterPath": movie.poster_path,
                    "viewers": 0,
                },
            )
            entry["viewers"] += int(viewers)

    items = sorted(
        counts.values(), key=lambda e: e["viewers"], reverse=True
    )[:limit]

    return {
        "resolved": True,
        "city": place["city"],
        "region": place["region"],
        "country": place["country"],
        "items": items,
    }
