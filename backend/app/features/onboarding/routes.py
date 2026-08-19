"""Onboarding — five steps, structured facts only.

    languages → favourite films → favourite cast/crew → preferences → ready

The purpose is cold-start personalisation and nothing else (KASET.md §8). Every
step writes plain rows that later systems read directly; nothing here is
inferred, scored, or embedded.

Only step 1 is required. Films, people and preferences can each be skipped —
a user who wants to get straight to logging should be able to.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.integrations import tmdb
from app.shared.models.onboarding import (
    FavoriteMovie,
    FavoritePerson,
    LanguageSelection,
    ViewingPreferences,
)
from app.shared.models.user import User

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

MAX_FAVOURITE_FILMS = 8
MAX_FAVOURITE_PEOPLE = 8


# ── Schemas ──────────────────────────────────────────────────────────────────

class LanguagesIn(BaseModel):
    languages: list[str] = Field(default_factory=list)


class FilmIn(BaseModel):
    tmdb_id: int = Field(..., alias="tmdbId")
    title: str
    poster_path: str | None = Field(None, alias="posterPath")

    model_config = {"populate_by_name": True}


class FilmsIn(BaseModel):
    films: list[FilmIn] = Field(default_factory=list)


class PersonIn(BaseModel):
    tmdb_id: int = Field(..., alias="tmdbId")
    name: str
    profile_path: str | None = Field(None, alias="profilePath")
    known_for: str = Field("Acting", alias="knownFor")

    model_config = {"populate_by_name": True}


class PeopleIn(BaseModel):
    people: list[PersonIn] = Field(default_factory=list)


class PreferencesIn(BaseModel):
    platforms: list[str] = Field(default_factory=list)
    prefers_theatre: bool = Field(False, alias="prefersTheatre")
    preferred_decades: list[int] = Field(default_factory=list, alias="preferredDecades")

    model_config = {"populate_by_name": True}


# ── Step 1 · Languages ───────────────────────────────────────────────────────

@router.post("/languages")
async def set_languages(
    body: LanguagesIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the user's language selection. Idempotent — the client may
    re-submit the whole set on every edit."""
    await db.execute(delete(LanguageSelection).where(LanguageSelection.user_id == user.id))
    seen: set[str] = set()
    for code in body.languages:
        code = code.strip().lower()
        if not code or code in seen:
            continue
        seen.add(code)
        db.add(LanguageSelection(user_id=user.id, language=code))
    await db.flush()
    return {"ok": True, "languages": sorted(seen)}


# ── Step 2 · Favourite films ─────────────────────────────────────────────────

@router.get("/films/search")
async def search_films(q: str = Query(..., min_length=1), _user: User = Depends(get_current_user)):
    """Film search for the favourites picker."""
    try:
        results = (await tmdb.search_movies(q)).get("results") or []
    except Exception:  # noqa: BLE001 - a TMDB outage yields no results, not a 500
        results = []
    return {
        "results": [
            {
                "tmdbId": r["id"],
                "title": r.get("title") or "",
                "posterPath": r.get("poster_path"),
                "year": (r.get("release_date") or "")[:4] or None,
            }
            for r in results
            if r.get("id")
        ][:20]
    }


@router.post("/films")
async def set_favourite_films(
    body: FilmsIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the user's favourite films, preserving the order they chose."""
    if len(body.films) > MAX_FAVOURITE_FILMS:
        raise HTTPException(
            status_code=422, detail=f"Pick at most {MAX_FAVOURITE_FILMS} films"
        )
    await db.execute(delete(FavoriteMovie).where(FavoriteMovie.user_id == user.id))
    seen: set[int] = set()
    for position, film in enumerate(body.films):
        if film.tmdb_id in seen:
            continue
        seen.add(film.tmdb_id)
        db.add(
            FavoriteMovie(
                user_id=user.id,
                tmdb_id=film.tmdb_id,
                title=film.title,
                poster_path=film.poster_path,
                position=position,
            )
        )
    await db.flush()
    return {"ok": True, "count": len(seen)}


# ── Step 3 · Favourite cast & crew ───────────────────────────────────────────

@router.get("/people/search")
async def search_people(q: str = Query(..., min_length=1), _user: User = Depends(get_current_user)):
    """Cast/crew search for the favourites picker."""
    try:
        results = (await tmdb.search_people(q)).get("results") or []
    except Exception:  # noqa: BLE001
        results = []
    return {
        "results": [
            {
                "tmdbId": r["id"],
                "name": r.get("name") or "",
                "profilePath": r.get("profile_path"),
                "knownFor": r.get("known_for_department") or "Acting",
            }
            for r in results
            if r.get("id")
        ][:20]
    }


@router.post("/people")
async def set_favourite_people(
    body: PeopleIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the user's favourite cast/crew, preserving their order."""
    if len(body.people) > MAX_FAVOURITE_PEOPLE:
        raise HTTPException(
            status_code=422, detail=f"Pick at most {MAX_FAVOURITE_PEOPLE} people"
        )
    await db.execute(delete(FavoritePerson).where(FavoritePerson.user_id == user.id))
    seen: set[int] = set()
    for position, person in enumerate(body.people):
        if person.tmdb_id in seen:
            continue
        seen.add(person.tmdb_id)
        db.add(
            FavoritePerson(
                user_id=user.id,
                tmdb_id=person.tmdb_id,
                name=person.name,
                profile_path=person.profile_path,
                known_for=person.known_for,
                position=position,
            )
        )
    await db.flush()
    return {"ok": True, "count": len(seen)}


# ── Step 4 · Viewing preferences (optional) ──────────────────────────────────

@router.post("/preferences")
async def set_preferences(
    body: PreferencesIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(ViewingPreferences).where(ViewingPreferences.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        row = ViewingPreferences(user_id=user.id)
        db.add(row)
    row.platforms = body.platforms or None
    row.prefers_theatre = body.prefers_theatre
    row.preferred_decades = body.preferred_decades or None
    await db.flush()
    return {"ok": True}


# ── Step 5 · Ready ───────────────────────────────────────────────────────────

@router.post("/complete")
async def complete(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Flip the user out of onboarding. Deliberately unguarded: a user who
    skipped every optional step still gets into the app."""
    user.onboarded = True
    await db.flush()
    return {"ok": True, "onboarded": True}


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/status")
async def status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """What the user has chosen so far, so the client can resume mid-flow and
    prefill each step on a revisit."""
    languages = (
        await db.execute(
            select(LanguageSelection.language).where(LanguageSelection.user_id == user.id)
        )
    ).scalars().all()

    films = (
        await db.execute(
            select(FavoriteMovie)
            .where(FavoriteMovie.user_id == user.id)
            .order_by(FavoriteMovie.position)
        )
    ).scalars().all()

    people = (
        await db.execute(
            select(FavoritePerson)
            .where(FavoritePerson.user_id == user.id)
            .order_by(FavoritePerson.position)
        )
    ).scalars().all()

    prefs = (
        await db.execute(
            select(ViewingPreferences).where(ViewingPreferences.user_id == user.id)
        )
    ).scalar_one_or_none()

    return {
        "onboarded": user.onboarded,
        "languages": sorted(languages),
        "films": [
            {
                "tmdbId": f.tmdb_id,
                "title": f.title,
                "posterPath": f.poster_path,
            }
            for f in films
        ],
        "people": [
            {
                "tmdbId": p.tmdb_id,
                "name": p.name,
                "profilePath": p.profile_path,
                "knownFor": p.known_for,
            }
            for p in people
        ],
        "preferences": {
            "platforms": (prefs.platforms if prefs else None) or [],
            "prefersTheatre": bool(prefs.prefers_theatre) if prefs else False,
            "preferredDecades": (prefs.preferred_decades if prefs else None) or [],
        },
    }
