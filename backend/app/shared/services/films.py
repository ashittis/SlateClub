"""Film resolution and serialization — the app-wide way to turn a TMDB id into
a local `Movie` row, and a `Movie` row into JSON.

Kaset never pre-imports a catalog. A film enters the database the first time
anyone searches for it, opens it, or logs it, and this module is where that
happens. It lives in `shared/` because almost every slice needs it: diary,
ratings, watchlist, DMs and discovery all resolve films.

Previously these were private helpers (`_get_or_fetch_movie`, `_upsert_movie`,
`_movie_payload`) split across the movies and users route files, and imported
across slice boundaries by underscore-name. Promoting them is what lets the
films slice stay thin.
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import tmdb
from app.shared.models.movie import Movie


async def upsert_movie(db: AsyncSession, data: dict) -> Movie:
    """Cache a TMDB payload as a local film row and return it.

    Only non-null fields overwrite existing values, so a partial payload (a
    search result, say) never blanks out richer data fetched earlier.
    """
    tmdb_id = data.get("id") or data.get("tmdb_id")
    if not tmdb_id:
        raise HTTPException(status_code=422, detail="TMDB payload has no id")

    movie = (
        await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    ).scalar_one_or_none()

    fields = dict(
        title=data.get("title", ""),
        overview=data.get("overview"),
        poster_path=data.get("poster_path"),
        backdrop_path=data.get("backdrop_path"),
        release_date=data.get("release_date"),
        runtime=data.get("runtime"),
        vote_average=data.get("vote_average"),
        vote_count=data.get("vote_count"),
        popularity=data.get("popularity"),
        original_language=data.get("original_language"),
        genres=data.get("genres"),
        credits=data.get("credits"),
    )

    if movie:
        for key, value in fields.items():
            if value is not None:
                setattr(movie, key, value)
    else:
        movie = Movie(tmdb_id=tmdb_id, **fields)
        db.add(movie)

    await db.flush()
    return movie


async def get_or_fetch_film(tmdb_id: int, db: AsyncSession) -> Movie:
    """Resolve a TMDB id to a local film row, fetching it the first time.

    Raises 404 when TMDB doesn't know the id, so callers can pass a user-supplied
    id straight through without pre-validating it.
    """
    row = (
        await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    ).scalar_one_or_none()
    if row is not None:
        return row

    try:
        data = await tmdb.get_movie(tmdb_id)
        data["credits"] = await tmdb.get_movie_credits(tmdb_id)
    except Exception as exc:  # noqa: BLE001 - unknown id or TMDB outage
        raise HTTPException(status_code=404, detail=f"Film {tmdb_id} not found") from exc

    return await upsert_movie(db, data)


def film_payload(m: Movie) -> dict:
    """The film shape every list and card in the app renders from.

    Keep this the single serializer — a film should look identical whether it
    arrives via the diary, a watchlist, search, or a DM.
    """
    return {
        "id": m.id,
        "tmdbId": m.tmdb_id,
        "title": m.title,
        "posterPath": m.poster_path,
        "backdropPath": m.backdrop_path,
        "releaseDate": m.release_date,
        "year": (m.release_date or "")[:4] or None,
        "runtime": m.runtime,
        "voteAverage": m.vote_average,
        "originalLanguage": m.original_language,
    }


def directors_of(m: Movie) -> list[dict]:
    """Directors from the cached TMDB credits blob, or [] if not fetched yet."""
    crew = (m.credits or {}).get("crew") or []
    return [
        {"tmdbId": c.get("id"), "name": c.get("name"), "profilePath": c.get("profile_path")}
        for c in crew
        if c.get("job") == "Director" and c.get("id")
    ]


def top_cast(m: Movie, limit: int = 12) -> list[dict]:
    """Billed cast, in TMDB's billing order."""
    cast = (m.credits or {}).get("cast") or []
    return [
        {
            "tmdbId": c.get("id"),
            "name": c.get("name"),
            "character": c.get("character"),
            "profilePath": c.get("profile_path"),
        }
        for c in cast[:limit]
        if c.get("id")
    ]
