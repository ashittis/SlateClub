"""Brave Search — the web-search source for the Community Intelligence Engine.

Reddit's own search only sees Reddit. This brings the *rest* of the film
community's recommendation talk into range with one legitimate REST call per
query — no HTML scraping: film blogs (Collider, ScreenRant, IndieWire, Taste of
Cinema), "N movies like X" listicles, YouTube video titles, and the
site:reddit.com threads Reddit's own relevance search misses.

Modelled on integrations/tmdb.py (lazy httpx.AsyncClient singleton + _fetch
retry) with integrations/reddit.py's process-global rate gate (Brave's free tier
is ~1 req/s). Degrades to [] when BRAVE_SEARCH_API_KEY is unset, so the discovery
engine runs Reddit-only. The provider is swappable (SerpAPI/Bing) behind
search() — callers only ever see [{title, url, snippet}].

Offline only. Like integrations.reddit, this must never run on the request path;
it is called from the discovery warmer / off-response tasks.
"""

from __future__ import annotations

import asyncio
import time

import httpx

from app.core.config import settings

_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"

# Brave's free tier averages ~1 query/s; hold a conservative process-global gate
# so concurrent warms can't burst past it (mirrors integrations/reddit.py).
_MIN_INTERVAL = 1.0

_TRANSIENT = (
    httpx.ConnectError,
    httpx.ReadError,
    httpx.RemoteProtocolError,
    httpx.ConnectTimeout,
)

_client: httpx.AsyncClient | None = None
_gate_lock = asyncio.Lock()
_last_call: float = 0.0


def is_available() -> bool:
    return bool(settings.BRAVE_SEARCH_API_KEY)


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=15.0)
    return _client


async def aclose() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def _rate_gate() -> None:
    """Serialise a minimum interval between requests, process-globally."""
    global _last_call
    async with _gate_lock:
        wait = _last_call + _MIN_INTERVAL - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        _last_call = time.monotonic()


async def _fetch(query: str, count: int, *, retries: int = 3) -> dict | None:
    """GET the Brave web-search endpoint. Returns parsed JSON or None (never
    raises into the batch loop). Honours 429 Retry-After; backs off on 5xx."""
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": settings.BRAVE_SEARCH_API_KEY,
    }
    params = {"q": query, "count": min(count, 20), "safesearch": "moderate"}
    for attempt in range(retries):
        await _rate_gate()
        try:
            resp = await _get_client().get(_ENDPOINT, params=params, headers=headers)
        except _TRANSIENT as exc:
            if attempt == retries - 1:
                print(f"[websearch] transport error on {query!r}: {exc}")
                return None
            await asyncio.sleep(2**attempt)
            continue
        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", 2**attempt))
            await asyncio.sleep(min(retry_after, 30))
            continue
        if resp.status_code >= 500:
            await asyncio.sleep(2**attempt)
            continue
        if resp.status_code >= 400:
            print(f"[websearch] HTTP {resp.status_code} on {query!r}")
            return None
        try:
            return resp.json()
        except ValueError:
            return None
    return None


async def search(query: str, *, count: int = 10) -> list[dict]:
    """Run one web search. Returns [{title, url, snippet}] (snippet = Brave's
    result description, which is where the recommendation talk lives), or []
    when unavailable / on any failure. Defensive — never raises."""
    if not is_available() or not query:
        return []
    data = await _fetch(query, count)
    if not isinstance(data, dict):
        return []
    results = (((data.get("web") or {}).get("results")) or [])
    out: list[dict] = []
    for r in results:
        if not isinstance(r, dict):
            continue
        out.append({
            "title": (r.get("title") or "").strip(),
            "url": (r.get("url") or "").strip(),
            # Brave returns description with <strong> highlight tags — strip them.
            "snippet": (r.get("description") or "")
            .replace("<strong>", "")
            .replace("</strong>", "")
            .strip(),
        })
    return out
