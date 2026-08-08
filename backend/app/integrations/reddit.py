"""
Reddit — offline movie-identity enrichment.

TMDB overviews are marketing copy; Reddit threads carry the tone, divisiveness,
pacing feel, and comparison talk ("feels like early Tarkovsky") that the plot
summary omits — strongest exactly where the LLM's base knowledge is weakest
(non-English, arthouse). `discussion_text()` returns comparison-rich sentences
to feed movie_identity's prompt.

httpx, not praw (praw is synchronous — it would block the event loop inside the
async extractor). Modelled on integrations/tmdb.py but adds the two things it
lacks: OAuth2 + a GLOBAL rate gate that holds ≤60 req/min regardless of how many
workers call concurrently. NEVER import this from the request path — it is
threaded into movie_identity via a parameter so that module stays network-free.
"""

from __future__ import annotations

import asyncio
import base64
import re
import time

import httpx

from app.core.config import settings

_OAUTH_URL = "https://www.reddit.com/api/v1/access_token"
_API_BASE = "https://oauth.reddit.com"

# Rate gate — Reddit's OAuth budget averages ~100 QPM; hold a conservative 60/min
# (1 req/s). The gate is process-global, so raising --concurrency speeds up the
# LLM/DB side while Reddit stays pinned.
_MIN_INTERVAL = 1.0
_DEFAULT_UA = settings.REDDIT_USER_AGENT or "slateclub/1.0"

# Comparison sentences are the signal we want ("similar to…", "fans of…").
_COMPARISON = re.compile(
    r"[^.!?\n]*\b(?:like|similar to|reminds me of|feels like|compared to|"
    r"fans of|if you liked|in the vein of|same energy as|companion piece)\b"
    r"[^.!?\n]*[.!?]",
    re.IGNORECASE,
)
_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)

# Language → an extra sub with real depth for that industry.
_LANG_SUBS = {
    "hi": "bollywood", "ta": "kollywood", "te": "tollywood",
    "ml": "MalayalamMovies", "kn": "kannada", "ko": "koreanfilm",
    "ja": "JapaneseMovies",
}
_BASE_SUBS = "movies+TrueFilm+criterion+horror+flicks"

_MAX_CHARS = 3200  # ~800 tokens

# ── module state ────────────────────────────────────────────────
_client: httpx.AsyncClient | None = None
_token: str | None = None
_token_expiry: float = 0.0
_token_lock = asyncio.Lock()
_gate_lock = asyncio.Lock()
_last_call: float = 0.0


def is_available() -> bool:
    return bool(settings.REDDIT_CLIENT_ID and settings.REDDIT_CLIENT_SECRET)


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=20.0, headers={"User-Agent": _DEFAULT_UA})
    return _client


async def aclose() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def _get_token() -> str | None:
    global _token, _token_expiry
    if _token and time.monotonic() < _token_expiry - 60:
        return _token
    async with _token_lock:
        if _token and time.monotonic() < _token_expiry - 60:
            return _token
        if not is_available():
            return None
        basic = base64.b64encode(
            f"{settings.REDDIT_CLIENT_ID}:{settings.REDDIT_CLIENT_SECRET}".encode()
        ).decode()
        try:
            resp = await _get_client().post(
                _OAUTH_URL,
                data={"grant_type": "client_credentials"},
                headers={"Authorization": f"Basic {basic}", "User-Agent": _DEFAULT_UA},
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # noqa: BLE001
            print(f"[reddit] token fetch failed: {exc}")
            return None
        _token = data.get("access_token")
        _token_expiry = time.monotonic() + float(data.get("expires_in", 3600))
        return _token


async def _rate_gate() -> None:
    """Serialise a minimum interval between requests, process-globally."""
    global _last_call, _MIN_INTERVAL
    async with _gate_lock:
        wait = _last_call + _MIN_INTERVAL - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        _last_call = time.monotonic()


async def _fetch(path: str, params: dict | None = None, *, retries: int = 3) -> dict | list | None:
    """GET an oauth.reddit.com path. Returns parsed JSON or None (never raises
    into the batch loop). Honours Retry-After on 429; refreshes token on 401."""
    global _MIN_INTERVAL, _token
    token = await _get_token()
    if token is None:
        return None
    for attempt in range(retries):
        await _rate_gate()
        try:
            resp = await _get_client().get(
                f"{_API_BASE}{path}",
                params={**(params or {}), "raw_json": 1},
                headers={"Authorization": f"Bearer {token}", "User-Agent": _DEFAULT_UA},
            )
        except (httpx.ConnectError, httpx.ReadError, httpx.ConnectTimeout, httpx.RemoteProtocolError) as exc:
            if attempt == retries - 1:
                print(f"[reddit] transport error on {path}: {exc}")
                return None
            await asyncio.sleep(2 ** attempt)
            continue

        # Self-tune: widen the interval when we're near the window limit.
        try:
            remaining = float(resp.headers.get("x-ratelimit-remaining", "99"))
            if remaining < 5:
                _MIN_INTERVAL = min(3.0, _MIN_INTERVAL + 0.5)
        except ValueError:
            pass

        if resp.status_code == 401 and attempt == 0:
            # Token revoked mid-batch — clear and retry once.
            _token = None
            token = await _get_token()
            if token is None:
                return None
            continue
        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", 2 ** attempt))
            await asyncio.sleep(min(retry_after, 30))
            continue
        if resp.status_code >= 500:
            await asyncio.sleep(2 ** attempt)
            continue
        if resp.status_code >= 400:
            return None
        try:
            return resp.json()
        except ValueError:
            return None
    return None


def _subs_for(language: str | None) -> str:
    extra = _LANG_SUBS.get((language or "").lower())
    return f"{_BASE_SUBS}+{extra}" if extra else _BASE_SUBS


async def _search(title: str, year: str | None, subs: str, *, limit: int = 5) -> list[dict]:
    q = f'"{title}"' + (f" {year}" if year else "")
    data = await _fetch(
        f"/r/{subs}/search",
        {"q": q, "restrict_sr": 1, "sort": "relevance", "type": "link", "limit": limit, "t": "all"},
    )
    if not isinstance(data, dict):
        return []
    return [c.get("data", {}) for c in data.get("data", {}).get("children", [])]


async def _comments(article_id: str, *, limit: int = 25) -> list[str]:
    data = await _fetch(
        f"/comments/{article_id}", {"limit": limit, "depth": 1, "sort": "top"}
    )
    if not isinstance(data, list) or len(data) < 2:
        return []
    bodies: list[str] = []
    for child in data[1].get("data", {}).get("children", []):
        if child.get("kind") == "more":
            continue
        body = child.get("data", {}).get("body")
        if body and body not in ("[deleted]", "[removed]"):
            bodies.append(body)
    return bodies


def _extract_sentences(texts: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for text in texts:
        for match in _COMPARISON.findall(text or ""):
            s = match.strip()
            if len(s) < 25 or len(s) > 280 or _URL_RE.search(s) or ">" in s:
                continue
            key = " ".join(s.lower().split())
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
    return out


async def recommendation_corpus(
    title: str,
    year: str | None,
    language: str | None,
    *,
    threads: int = 6,
    comments_per: int = 30,
) -> list[str]:
    """Raw text from Reddit "movies like X" discussions — submission bodies +
    top comments — for the discovery engine's LLM title-extraction pass.

    Unlike discussion_text() (which regex-filters down to comparison *sentences*
    for the identity extractor), this returns the *fuller* text because the
    downstream LLM needs whole comments to read WHICH films get recommended and
    WHY. Returns [] when Reddit is unconfigured or off-topic.

    Offline only — never call from the request path (Reddit's rate gate is
    process-global and this issues several requests per seed)."""
    if not is_available() or not title:
        return []
    subs = _subs_for(language)
    year_q = f" {year}" if year else ""
    queries = [
        f'movies like "{title}"{year_q}',
        f'if you liked "{title}"',
        f'"{title}" recommendations',
    ]

    submissions: list[dict] = []
    seen_ids: set[str] = set()
    for q in queries:
        data = await _fetch(
            f"/r/{subs}/search",
            {"q": q, "restrict_sr": 1, "sort": "relevance", "type": "link",
             "limit": max(2, threads // len(queries) + 1), "t": "all"},
        )
        if not isinstance(data, dict):
            continue
        for child in data.get("data", {}).get("children", []):
            sub = child.get("data", {})
            sid = sub.get("id")
            if sid and sid not in seen_ids:
                seen_ids.add(sid)
                submissions.append(sub)
        if len(submissions) >= threads:
            break

    texts: list[str] = []
    for sub in submissions[:threads]:
        title_txt = sub.get("title") or ""
        selftext = sub.get("selftext") or ""
        header = f"THREAD: {title_txt}\n{selftext}".strip()
        if header:
            texts.append(header[:_MAX_CHARS])
        art_id = sub.get("id")
        if art_id:
            bodies = await _comments(art_id, limit=comments_per)
            texts.extend(b for b in bodies if b and len(b) >= 20)
    return texts


async def discussion_text(title: str, year: str | None, language: str | None) -> str:
    """Comparison-rich Reddit sentences about a film, ≤~800 tokens. Empty string
    when unavailable, off-topic, or Reddit is not configured — every caller
    treats "" as 'no external context', so the extractor proceeds TMDB-only."""
    if not is_available() or not title:
        return ""
    subs = _subs_for(language)
    submissions = await _search(title, year, subs, limit=5)
    if not submissions:
        return ""

    texts: list[str] = [s.get("selftext", "") for s in submissions if s.get("selftext")]
    for sub in submissions[:5]:
        art_id = sub.get("id")
        if art_id:
            texts.extend(await _comments(art_id, limit=25))

    sentences = _extract_sentences(texts)
    joined = "\n".join(sentences)
    return joined[:_MAX_CHARS]
