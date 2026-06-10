import httpx

from ..core.config import settings

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=15.0)
    return _client


async def _fetch(path: str, params: dict | None = None) -> dict:
    client = get_client()
    p = {"api_key": settings.TMDB_API_KEY, **(params or {})}
    resp = await client.get(f"{settings.TMDB_BASE_URL}{path}", params=p)
    resp.raise_for_status()
    return resp.json()


# ─── Movies ──────────────────────────────────────────────────

async def search_movies(query: str, page: int = 1) -> dict:
    return await _fetch("/search/movie", {"query": query, "page": page, "include_adult": "false"})


async def get_movie(tmdb_id: int) -> dict:
    return await _fetch(f"/movie/{tmdb_id}")


async def get_movie_credits(tmdb_id: int) -> dict:
    return await _fetch(f"/movie/{tmdb_id}/credits")


async def get_movie_videos(tmdb_id: int) -> dict:
    return await _fetch(f"/movie/{tmdb_id}/videos")


async def get_popular_movies(page: int = 1) -> dict:
    return await _fetch("/movie/popular", {"page": page})


async def get_trending_movies(time_window: str = "week") -> dict:
    return await _fetch(f"/trending/movie/{time_window}")


async def get_top_rated_movies(page: int = 1) -> dict:
    return await _fetch("/movie/top_rated", {"page": page})


async def discover_movies(params: dict | None = None) -> dict:
    p = {"sort_by": "popularity.desc", "include_adult": "false", **(params or {})}
    return await _fetch("/discover/movie", p)


async def get_movie_recommendations(tmdb_id: int, page: int = 1) -> dict:
    """TMDB's own 'watch next' recommendations for a film — language-diverse,
    so a Hollywood seed yields Hollywood neighbours."""
    return await _fetch(f"/movie/{tmdb_id}/recommendations", {"page": page})


async def get_movie_similar(tmdb_id: int, page: int = 1) -> dict:
    """TMDB's similarity graph for a film (keyword/genre based)."""
    return await _fetch(f"/movie/{tmdb_id}/similar", {"page": page})


# ─── TV / Series ─────────────────────────────────────────────

async def search_tv(query: str, page: int = 1) -> dict:
    return await _fetch("/search/tv", {"query": query, "page": page, "include_adult": "false"})


async def get_tv(tmdb_id: int) -> dict:
    return await _fetch(f"/tv/{tmdb_id}")


async def get_tv_credits(tmdb_id: int) -> dict:
    return await _fetch(f"/tv/{tmdb_id}/credits")


async def get_tv_season(tmdb_id: int, season_number: int) -> dict:
    """Full season payload incl. the episodes array (each with vote_average)."""
    return await _fetch(f"/tv/{tmdb_id}/season/{season_number}")


async def get_tv_videos(tmdb_id: int) -> dict:
    return await _fetch(f"/tv/{tmdb_id}/videos")


async def get_popular_tv(page: int = 1) -> dict:
    return await _fetch("/tv/popular", {"page": page})


async def get_trending_tv(time_window: str = "week") -> dict:
    return await _fetch(f"/trending/tv/{time_window}")


async def get_tv_recommendations(tmdb_id: int, page: int = 1) -> dict:
    return await _fetch(f"/tv/{tmdb_id}/recommendations", {"page": page})


async def get_tv_similar(tmdb_id: int, page: int = 1) -> dict:
    return await _fetch(f"/tv/{tmdb_id}/similar", {"page": page})


# ─── People ──────────────────────────────────────────────────

async def search_people(query: str, page: int = 1) -> dict:
    return await _fetch("/search/person", {"query": query, "page": page, "include_adult": "false"})


async def get_popular_people(page: int = 1) -> dict:
    return await _fetch("/person/popular", {"page": page})


async def get_person_movie_credits(person_id: int) -> dict:
    return await _fetch(f"/person/{person_id}/movie_credits")


async def get_person_details(person_id: int) -> dict:
    return await _fetch(f"/person/{person_id}")
