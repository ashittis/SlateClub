"""
Recommendation API — Phase 3
Uses the full 4-stage ML pipeline (ARCHITECTURE.md Section 1.5)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func

from ..core.auth import get_current_user
from ..core.database import get_db
from ..integrations import tmdb
from ..models.user import User, UserTasteState
from ..models.movie import Movie
from ..models.actions import Rating, WatchHistory, WatchlistItem
from ..models.social import MicroFeedback
from ..models.onboarding import (
    FavoriteMovie,
    FavoritePerson,
    LanguageSelection,
    OnboardingSignals,
)
from ..ml.embeddings.taste_vector import movie_to_embedding, seed_prior_vector
from ..ml.pipeline.recommendation_pipeline import RecommendationPipeline
from ..services.impressions import log_impressions
from .movies import _upsert_movie

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

# Singleton pipeline instance (warm on first request)
_pipeline: RecommendationPipeline | None = None


def get_pipeline() -> RecommendationPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = RecommendationPipeline()
    return _pipeline


# Mapping from mood-axis values to a "persistent_mood" id that
# stage 4 can apply when the request didn't supply session_mood.
def _persistent_mood_from_signals(s: OnboardingSignals | None) -> str | None:
    if s is None:
        return None
    pacing = s.mood_pacing or 0.0
    tone = s.mood_tone or 0.0
    if pacing < -0.3:
        return "slow_contemplative"
    if pacing > 0.3:
        return "fast_intense"
    if tone < -0.3:
        return "dark_unsettling"
    if tone > 0.3:
        return "funny_light"
    return None


async def load_user_priors(user_id: str, db: AsyncSession) -> dict:
    """Pull onboarding signals + favourites + languages and project them
    into a `user_priors` dict the recommendation pipeline understands.
    Reused by both /for-you and /api/feed/hero.
    """
    signals = (
        await db.execute(
            select(OnboardingSignals).where(OnboardingSignals.user_id == user_id)
        )
    ).scalar_one_or_none()

    languages = [
        r[0]
        for r in (
            await db.execute(
                select(LanguageSelection.language).where(
                    LanguageSelection.user_id == user_id
                )
            )
        ).all()
    ]

    poster_picks: list[int] = []
    origin_id: int | None = None
    mood_pacing = mood_tone = mood_realism = 0.0
    if signals is not None:
        poster_picks = list(signals.poster_picks or [])
        origin_id = signals.origin_film_tmdb_id
        mood_pacing = float(signals.mood_pacing or 0.0)
        mood_tone = float(signals.mood_tone or 0.0)
        mood_realism = float(signals.mood_realism or 0.0)

    favourite_tmdb_ids = [
        r[0]
        for r in (
            await db.execute(
                select(FavoriteMovie.tmdb_id).where(
                    FavoriteMovie.user_id == user_id
                )
            )
        ).all()
    ]

    favorite_directors = [
        r[0].lower()
        for r in (
            await db.execute(
                select(FavoritePerson.name).where(
                    FavoritePerson.user_id == user_id
                )
            )
        ).all()
        if r[0]
    ]

    # Resolve cached embeddings for poster_picks + origin + favourites.
    needed_ids = list(
        {*poster_picks, *favourite_tmdb_ids, *([origin_id] if origin_id else [])}
    )
    embeddings_by_tmdb: dict[int, list] = {}
    if needed_ids:
        rows = (
            await db.execute(
                select(Movie).where(Movie.tmdb_id.in_(needed_ids))
            )
        ).scalars().all()
        for m in rows:
            embeddings_by_tmdb[m.tmdb_id] = movie_to_embedding(_movie_to_dict(m))

    poster_embs = [embeddings_by_tmdb[i] for i in poster_picks if i in embeddings_by_tmdb]
    fav_embs = [
        embeddings_by_tmdb[i] for i in favourite_tmdb_ids if i in embeddings_by_tmdb
    ]
    origin_emb = embeddings_by_tmdb.get(origin_id) if origin_id else None

    seed_prior = seed_prior_vector(
        poster_embeddings=poster_embs or None,
        origin_embedding=origin_emb,
        favourite_embeddings=fav_embs or None,
        mood_pacing=mood_pacing or None,
        mood_tone=mood_tone or None,
        mood_realism=mood_realism or None,
        language_codes=languages or None,
    )

    # LLM-derived taste embedding (OpenAI). Stays None until the
    # taste_describer + embed pipeline has run for this user. The
    # recommendation pipeline gates the semantic candidate gen on its
    # presence, so this is safe to leave empty.
    taste_state = (
        await db.execute(
            select(UserTasteState).where(UserTasteState.user_id == user_id)
        )
    ).scalar_one_or_none()

    return {
        "seed_prior": seed_prior,
        "languages": languages,
        "mood_pacing": mood_pacing,
        "mood_tone": mood_tone,
        "mood_realism": mood_realism,
        "persistent_mood": _persistent_mood_from_signals(signals),
        "taste_embedding": (
            taste_state.taste_embedding if taste_state is not None else None
        ),
        "favorite_directors": favorite_directors,
    }


# Tiny in-process cache so we don't TMDB-hit on every page load.
# Key: tuple(sorted_languages); Value: timestamp last hydrated.
import time

_HYDRATE_CACHE: dict[tuple[str, ...], float] = {}
_HYDRATE_TTL_SECONDS = 60 * 60  # 1 hour


async def hydrate_catalog_for_languages(
    languages: list[str],
    db: AsyncSession,
    *,
    target_per_lang: int = 60,
    max_pages: int = 3,
) -> int:
    """
    Ensure the local Movie table has enough films per non-English
    language for the recommendation pipeline to actually rank them.

    A user who onboarded with Tamil + Korean will start with 0
    candidates in those languages — without this, the pipeline can't
    suggest anything in their preferred languages no matter how
    perfect the seed prior is.

    Defensive: each upsert is a savepoint; failures don't sink the call.
    """
    langs = [l for l in (languages or []) if l and l != "en"]
    if not langs:
        return 0

    key = tuple(sorted(langs))
    now = time.time()
    if (now - _HYDRATE_CACHE.get(key, 0)) < _HYDRATE_TTL_SECONDS:
        return 0
    _HYDRATE_CACHE[key] = now

    total_added = 0
    for lang in langs:
        existing = (
            await db.execute(
                select(func.count(Movie.id)).where(
                    Movie.original_language == lang
                )
            )
        ).scalar_one() or 0
        if existing >= target_per_lang:
            continue

        for page in range(1, max_pages + 1):
            try:
                resp = await tmdb.discover_movies(
                    {
                        "with_original_language": lang,
                        "sort_by": "popularity.desc",
                        "vote_count.gte": 10,
                        "page": page,
                    }
                )
            except Exception as exc:
                print(f"[hydrate] TMDB discover failed for lang={lang}: {exc}")
                break

            page_added = 0
            for raw in resp.get("results") or []:
                try:
                    raw["genres"] = [
                        {"id": gid, "name": ""}
                        for gid in (raw.get("genre_ids") or [])
                    ]
                    # Belt-and-braces: TMDB sometimes returns rows whose
                    # original_language doesn't match the filter (e.g.
                    # co-productions). Force it so language filtering works.
                    raw["original_language"] = lang
                    async with db.begin_nested():
                        await _upsert_movie(db, raw)
                    page_added += 1
                except Exception as exc:
                    print(
                        f"[hydrate] upsert failed for tmdb_id="
                        f"{raw.get('id')}: {exc}"
                    )
                    continue
            total_added += page_added
            # Stop early if we hit the target.
            existing += page_added
            if existing >= target_per_lang:
                break

    if total_added:
        try:
            await db.flush()
        except Exception as exc:
            print(f"[hydrate] flush failed: {exc}")

    return total_added


@router.get("/for-you")
async def for_you(
    session_mood: str | None = Query(None, description="slow_contemplative|fast_intense|funny_light|dark_unsettling|surprise|skip"),
    page: int = Query(1, ge=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ML-powered 'For You' feed using the 4-stage recommendation pipeline."""
    pipeline = get_pipeline()

    # 1. Gather user interactions
    ratings_result = await db.execute(
        select(Rating, Movie)
        .join(Movie, Rating.movie_id == Movie.id)
        .where(Rating.user_id == user.id)
    )
    ratings = ratings_result.all()

    watchlist_result = await db.execute(
        select(WatchlistItem, Movie)
        .join(Movie, WatchlistItem.movie_id == Movie.id)
        .where(WatchlistItem.user_id == user.id)
    )
    watchlist = watchlist_result.all()

    # Join FavoriteMovie with Movie table so we get real genres/metadata.
    # Without this, onboarding movie picks produce a zero-genre taste vector.
    fav_movies_result = await db.execute(
        select(FavoriteMovie, Movie)
        .outerjoin(Movie, Movie.tmdb_id == FavoriteMovie.tmdb_id)
        .where(FavoriteMovie.user_id == user.id)
    )
    fav_movies_rows = fav_movies_result.all()

    # Build interaction list for taste vector
    interactions = []
    for rating, movie in ratings:
        bucket = f"rating_{min(int(rating.value), 5)}"
        interactions.append({
            "movie_data": _movie_to_dict(movie),
            "signal_type": bucket,
            "created_at": rating.created_at,
        })

    for wl_item, movie in watchlist:
        interactions.append({
            "movie_data": _movie_to_dict(movie),
            "signal_type": "watchlisted",
            "created_at": wl_item.created_at,
        })

    for fav, fav_movie in fav_movies_rows:
        movie_data = (
            _movie_to_dict(fav_movie)
            if fav_movie is not None
            else {
                # Movie not yet cached locally — use sparse placeholder.
                # Genres/language will be blank but the "favorite" signal weight
                # still nudges vote_average/popularity dims of the taste vector.
                "id": f"fav_{fav.tmdb_id}",
                "genres": [],
                "vote_average": 8.0,
                "popularity": 100,
                "runtime": 120,
                "release_date": "",
                "original_language": "en",
            }
        )
        interactions.append({
            "movie_data": movie_data,
            "signal_type": "favorite",
            "created_at": fav.created_at,
        })

    # 2. Load onboarding-derived priors first — we need the user's
    #    languages BEFORE building all_movies so we can hydrate the
    #    catalog with films in those languages on the fly.
    user_priors = await load_user_priors(user.id, db)

    # 2b. Cold-start hydration: a fresh user with Tamil/Korean
    #     onboarding has 0 candidates in their langs. Pull a few
    #     pages from TMDB so the pipeline has something to rank.
    try:
        added = await hydrate_catalog_for_languages(
            user_priors.get("languages") or [], db
        )
        if added:
            print(f"[for-you] hydrated {added} films for user={user.id}")
    except Exception as exc:
        print(f"[for-you] hydrate failed: {exc}")

    # 3. Get all movies in catalog (now post-hydration)
    all_movies_result = await db.execute(select(Movie))
    all_movies = [_movie_to_dict(m) for m in all_movies_result.scalars().all()]

    # 4. Get watched history with completion signals
    watch_history_result = await db.execute(
        select(WatchHistory, Movie)
        .join(Movie, WatchHistory.movie_id == Movie.id)
        .where(WatchHistory.user_id == user.id)
    )
    watch_history_rows = watch_history_result.all()
    watched_ids = {wh.movie_id for wh, _ in watch_history_rows}

    # Build genre→avg_completion map for XGBoost 12th feature (0–100 scale)
    _genre_completion_buckets: dict[int, list[float]] = {}
    for wh, movie in watch_history_rows:
        pct = wh.completion_pct or 0.0
        for g in (movie.genres or []):
            gid = g.get("id") if isinstance(g, dict) else g
            if gid:
                _genre_completion_buckets.setdefault(int(gid), []).append(pct)
    genre_completion_map = {
        gid: sum(pcts) / len(pcts)
        for gid, pcts in _genre_completion_buckets.items()
    }

    # Add watch history to interactions with completion-based signal types
    for wh, movie in watch_history_rows:
        pct = wh.completion_pct or 0.0
        if pct >= 90:
            sig = "watched"
        elif pct >= 70:
            sig = "watched_partial"
        elif pct < 30:
            sig = "abandoned"
        else:
            continue  # 30–69%: too ambiguous
        interactions.append({
            "movie_data": _movie_to_dict(movie),
            "signal_type": sig,
            "created_at": wh.watched_at,
        })

    # MicroFeedback feeds two paths: dismissed_ids (Stage 2 filter) and
    # the interactions list (Stage 1 taste vector — negative signals
    # push the vector away from those movies).
    feedback_result = await db.execute(
        select(MicroFeedback, Movie)
        .join(Movie, MicroFeedback.movie_id == Movie.id)
        .where(MicroFeedback.user_id == user.id)
    )
    dismissed_ids: set[str] = set()
    for fb, movie in feedback_result.all():
        if fb.type == "not_for_me":
            dismissed_ids.add(fb.movie_id)
        interactions.append({
            "movie_data": _movie_to_dict(movie),
            "signal_type": fb.type,
            "created_at": fb.created_at,
        })

    # 4c. Inject completion map + graph candidates into priors so the pipeline
    #     can use them without being made async.
    user_priors["genre_completion_map"] = genre_completion_map

    try:
        from ..ml.graph.graph_recommend import get_graph_candidates
        user_priors["graph_candidates"] = await get_graph_candidates(user.id, limit=100)
    except Exception as exc:
        print(f"[for-you] graph candidates failed: {exc}")
        user_priors["graph_candidates"] = []

    # 5. Run pipeline
    mood = session_mood if session_mood and session_mood != "skip" else None
    results = pipeline.run(
        user_id=user.id,
        user_interactions=interactions,
        all_movies=all_movies,
        watched_ids=watched_ids,
        dismissed_ids=dismissed_ids,
        session_mood=mood,
        n_results=30,
        user_priors=user_priors,
    )

    # 5. Paginate (10 per page)
    per_page = 10
    start = (page - 1) * per_page
    page_results = results[start:start + per_page]

    # 5b. Log impressions for the items actually shown to the user.
    # Failure here must not break the response — log and move on.
    try:
        await log_impressions(db, user_id=user.id, items=page_results)
    except Exception as exc:
        print(f"[for-you] impression logging failed: {exc}")

    # 6. Clean internal fields from response
    clean_results = []
    for r in page_results:
        clean_results.append({
            "id": r.get("id"),
            "tmdb_id": r.get("tmdb_id"),
            "title": r.get("title"),
            "poster_path": r.get("poster_path"),
            "backdrop_path": r.get("backdrop_path"),
            "release_date": r.get("release_date"),
            "runtime": r.get("runtime"),
            "vote_average": r.get("vote_average"),
            "genres": r.get("genres"),
            "explanation": r.get("_explanation", "Picked for you"),
            "surface": r.get("_surface", "for_you"),
            "match_score": round(r.get("_rank_score", 0) * 100),
        })

    return {
        "results": clean_results,
        "page": page,
        "total": len(results),
        "session_mood": session_mood,
        "pipeline": "ml-v1",
    }


@router.get("/session-moods")
async def session_moods():
    """Return available session mood options for the UI."""
    return {
        "moods": [
            {"id": "slow_contemplative", "label": "Slow & contemplative"},
            {"id": "fast_intense", "label": "Fast & intense"},
            {"id": "funny_light", "label": "Funny & light"},
            {"id": "dark_unsettling", "label": "Dark & unsettling"},
            {"id": "surprise", "label": "Surprise me"},
        ]
    }


@router.get("/debug")
async def debug(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Diagnostic dump of what the recommendation system knows about the user.
    Lets you verify onboarding signals are being read and the catalog has
    candidates in your languages.
    """
    priors = await load_user_priors(user.id, db)

    # Onboarding raw rows
    signals = (
        await db.execute(
            select(OnboardingSignals).where(OnboardingSignals.user_id == user.id)
        )
    ).scalar_one_or_none()
    languages = [
        r[0]
        for r in (
            await db.execute(
                select(LanguageSelection.language).where(
                    LanguageSelection.user_id == user.id
                )
            )
        ).all()
    ]
    fav_count = (
        await db.execute(
            select(func.count(FavoriteMovie.id)).where(
                FavoriteMovie.user_id == user.id
            )
        )
    ).scalar_one() or 0

    fav_directors = [
        r[0]
        for r in (
            await db.execute(
                select(FavoritePerson.name).where(
                    FavoritePerson.user_id == user.id
                )
            )
        ).all()
        if r[0]
    ]

    # Cache count by language — what the pipeline can actually rank.
    lang_counts = {
        r[0] or "unknown": r[1]
        for r in (
            await db.execute(
                select(Movie.original_language, func.count(Movie.id)).group_by(
                    Movie.original_language
                )
            )
        ).all()
    }

    # Interaction stats (drives prior_weight in compute_user_taste_vector)
    n_ratings = (
        await db.execute(
            select(func.count(Rating.id)).where(Rating.user_id == user.id)
        )
    ).scalar_one() or 0
    n_watchlist = (
        await db.execute(
            select(func.count(WatchlistItem.id)).where(
                WatchlistItem.user_id == user.id
            )
        )
    ).scalar_one() or 0
    n_watched = (
        await db.execute(
            select(func.count(WatchHistory.id)).where(
                WatchHistory.user_id == user.id
            )
        )
    ).scalar_one() or 0

    seed_prior_norm = float(
        sum(float(x) ** 2 for x in priors["seed_prior"]) ** 0.5
    )

    return {
        "user": {"id": user.id, "username": user.username},
        "onboarding": {
            "languages": languages,
            "favouriteMovieCount": fav_count,
            "favouriteDirectors": fav_directors,
            "originFilmTmdbId": signals.origin_film_tmdb_id if signals else None,
            "moodPacing": signals.mood_pacing if signals else None,
            "moodTone": signals.mood_tone if signals else None,
            "moodRealism": signals.mood_realism if signals else None,
            "platforms": signals.platforms if signals else None,
            "posterPicks": signals.poster_picks if signals else None,
        },
        "computedPriors": {
            "languages": priors["languages"],
            "moodPacing": priors["mood_pacing"],
            "moodTone": priors["mood_tone"],
            "moodRealism": priors["mood_realism"],
            "persistentMood": priors["persistent_mood"],
            "seedPriorNonZero": seed_prior_norm > 0,
            "seedPriorNorm": round(seed_prior_norm, 4),
            "favoriteDirectors": priors.get("favorite_directors", []),
            "favoriteDirectorCount": len(priors.get("favorite_directors") or []),
        },
        "interactions": {
            "ratings": n_ratings,
            "watchlist": n_watchlist,
            "watched": n_watched,
            "favourites": fav_count,
            "totalForBlend": n_ratings + n_watchlist + fav_count,
        },
        "catalogue": {
            "totalMovies": sum(lang_counts.values()),
            "byLanguage": lang_counts,
            "userLanguageCounts": {
                lang: lang_counts.get(lang, 0) for lang in priors["languages"]
            },
        },
        "diagnostics": _diagnose(priors, lang_counts, n_ratings + n_watchlist),
    }


def _diagnose(
    priors: dict, lang_counts: dict[str, int], n_interactions: int
) -> list[str]:
    msgs: list[str] = []
    user_langs = [l for l in priors["languages"] if l and l != "en"]

    if not user_langs:
        msgs.append(
            "You picked English-only languages — recs will mirror global popularity."
        )
    else:
        for lang in user_langs:
            count = lang_counts.get(lang, 0)
            if count < 20:
                msgs.append(
                    f"Only {count} films cached in '{lang}'. "
                    "The hydrator should top this up on the next /for-you call."
                )

    if n_interactions == 0:
        msgs.append(
            "Zero interactions — the seed prior is doing all the work. "
            "Rate or shelve a few films to refine recs."
        )

    if priors["seed_prior"] is None or float(
        sum(float(x) ** 2 for x in priors["seed_prior"]) ** 0.5
    ) == 0:
        msgs.append(
            "Seed prior is empty — onboarding signals didn't produce a vector. "
            "Re-check the mood sliders and language picks."
        )

    fav_directors = priors.get("favorite_directors") or []
    if fav_directors:
        msgs.append(
            f"Favourite directors active: {', '.join(fav_directors)}. "
            "Their films get a 50% score boost in Stage 3. "
            "Boost only fires when movies have credits data — run TMDB enrichment if missing."
        )

    if not msgs:
        msgs.append("All systems nominal — your recs should reflect onboarding.")
    return msgs


def _movie_to_dict(movie: Movie) -> dict:
    """Convert SQLAlchemy Movie to dict for ML pipeline."""
    return {
        "id": movie.id,
        "tmdb_id": movie.tmdb_id,
        "title": movie.title,
        "overview": movie.overview,
        "poster_path": movie.poster_path,
        "backdrop_path": movie.backdrop_path,
        "release_date": movie.release_date,
        "runtime": movie.runtime,
        "vote_average": movie.vote_average,
        "vote_count": movie.vote_count,
        "popularity": movie.popularity,
        "original_language": movie.original_language,
        "genres": movie.genres,
        "credits": movie.credits,
        # Pass through OpenAI-extracted identity + embedding for the
        # recommendation pipeline's semantic candidate gen. Stays None
        # for any movie that hasn't been processed by
        # scripts/extract_movie_identities.py yet.
        "identity_json": movie.identity_json,
        "identity_embedding": movie.identity_embedding,
    }
