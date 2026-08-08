"""Community Intelligence Engine — web-sourced consensus for "what to watch after X".

The moat feature. Instead of asking the LLM "what films share this film's
essence" (that's services/recommendation/similar_films.py), this asks: **what
does the film community across the web actually recommend after this film**, and
grounds the answer in REAL weighted mention frequency across Reddit + web search.

Pipeline (the expensive path — runs offline / off-response, never blocking a
request):

    gather corpus (Reddit "movies like X" threads + Brave web search)
      → LLM title-extraction per source (grounded, extraction only)
      → resolve each title to TMDB (reuse similar_films._resolve_title) + upsert
      → weighted-frequency consensus scoring (community_scoring, pure)
      → LLM consensus reasoning: one-line "why the community recommends it"
      → persist to discovery_cache (month + version PK, auto-expiring)

The request path only READS the cached pool and personalizes it per user
(community_personalize). Both sources degrade to empty independently; if neither
yields anything (or the LLM is down) the caller falls back to the essence engine.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.discovery.community_scoring import (
    aggregate_mentions,
    classify_source,
    match_score,
    source_label,
)
from app.features.recommendation.similar_films import _resolve_title, find_similar_films
from app.integrations import reddit, websearch
from app.ml.llm import openai_client as llm
from app.shared.models.discovery_cache import DiscoveryCache
from app.shared.models.movie import Movie

# Bump when the scrape queries, extraction prompt, or scoring change so stale
# cached pools are ignored (composite PK already expires them monthly).
_COMMUNITY_VERSION = 1
_POOL_SIZE = 24          # candidates cached per seed
_ANSWER_SIZE = 5         # window served to the client
_GROUP_MAX_CHARS = 6000  # per-source corpus cap fed to the extraction LLM

_EXTRACT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "films": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "year": {"type": ["integer", "null"]},
                },
                "required": ["title"],
            },
        }
    },
    "required": ["films"],
}

_CONSENSUS_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "essence": {
            "type": "string",
            "description": "ONE sentence naming the shared viewing experience the "
            "community keeps pointing to — the feeling/tone, not the genre.",
        },
        "films": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tmdbId": {"type": "integer"},
                    "why": {
                        "type": "string",
                        "description": "One plain line (max 14 words) on WHY the "
                        "community recommends this after the seed — the shared "
                        "feeling, e.g. 'same nonstop anxiety and desperation'.",
                    },
                },
                "required": ["tmdbId", "why"],
            },
        },
    },
    "required": ["essence", "films"],
}


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


# ── Corpus gathering ──────────────────────────────────────────


async def _gather_documents(seed: Movie) -> list[dict]:
    """Collect community text about "what to watch after {seed}" from Reddit +
    web search. Each document is {source, text}; source drives authority
    weighting. Both sources degrade to nothing independently."""
    title = seed.title or ""
    year = (seed.release_date or "")[:4] or None
    lang = seed.original_language
    docs: list[dict] = []

    if reddit.is_available():
        try:
            for text in await reddit.recommendation_corpus(title, year, lang):
                if text and len(text) >= 20:
                    docs.append({"source": "reddit", "text": text})
        except Exception as exc:  # noqa: BLE001
            print(f"[discovery] reddit corpus failed for {title!r}: {exc}")

    if websearch.is_available():
        queries = [
            f"movies like {title}",
            f"if you liked {title} what to watch next",
            f"films similar to {title} site:reddit.com",
            f"{title} similar movies recommendations",
        ]
        try:
            lists = await asyncio.gather(
                *(websearch.search(q, count=10) for q in queries),
                return_exceptions=True,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[discovery] web search failed for {title!r}: {exc}")
            lists = []
        for rl in lists:
            if isinstance(rl, Exception) or not rl:
                continue
            for r in rl:
                text = f"{r.get('title','')}\n{r.get('snippet','')}".strip()
                if len(text) >= 20:
                    docs.append({"source": classify_source(r.get("url", "")), "text": text})
    return docs


# ── Extraction + resolution ───────────────────────────────────


async def _extract_titles(seed_title: str, blob: str) -> list[dict]:
    """One grounded LLM pass over a source's corpus → the film titles it names as
    recommendations. Extraction only — no ranking, no invention beyond what the
    text supports. Returns [] when the LLM is unavailable."""
    if not llm.is_available() or not blob.strip():
        return []
    prompt = (
        "Below are real community discussions and articles about what films to "
        f"watch after the film \"{seed_title}\". Extract EVERY distinct film "
        "title that is recommended as something to watch after it. Rules: return "
        "only real film titles that actually appear as recommendations; include a "
        f"release year when stated; EXCLUDE \"{seed_title}\" itself; ignore vague "
        "references ('that one movie'), TV shows, and off-topic chatter. Do not "
        "invent titles that aren't in the text.\n\n"
        f"--- COMMUNITY TEXT ---\n{blob[:_GROUP_MAX_CHARS]}"
    )
    data = await llm.generate_json(prompt, response_schema=_EXTRACT_SCHEMA)
    films = (data or {}).get("films") or []
    out: list[dict] = []
    for f in films:
        title = (f.get("title") or "").strip()
        if title:
            out.append({"title": title, "year": f.get("year")})
    return out


async def _extract_and_resolve(
    db: AsyncSession, seed: Movie, docs: list[dict]
) -> list[dict]:
    """Group docs by source, extract titles per source (concurrently), resolve
    each unique title to a TMDB movie, upsert it locally, and return a flat list
    of resolved mentions [{tmdbId, source, stub}] ready for aggregation."""
    by_source: dict[str, list[str]] = {}
    for d in docs:
        by_source.setdefault(d["source"], []).append(d["text"])

    sources = list(by_source.keys())
    extractions = await asyncio.gather(
        *(_extract_titles(seed.title or "", "\n\n".join(by_source[s])) for s in sources)
    )

    # (title, year, source) mention tuples, deduped per source on title+year.
    raw_mentions: list[dict] = []
    for source, films in zip(sources, extractions):
        seen_local: set[tuple] = set()
        for f in films:
            key = (f["title"].strip().lower(), f.get("year"))
            if key in seen_local:
                continue
            seen_local.add(key)
            raw_mentions.append({"title": f["title"], "year": f.get("year"), "source": source})

    if not raw_mentions:
        return []

    # Resolve each UNIQUE title once (network-bound), then map back to mentions.
    unique: dict[tuple, dict] = {}
    for m in raw_mentions:
        unique.setdefault((m["title"].strip().lower(), m["year"]), m)
    keys = list(unique.keys())
    resolved = await asyncio.gather(
        *(_resolve_title(unique[k]["title"], unique[k]["year"]) for k in keys)
    )
    stub_by_key: dict[tuple, dict] = {
        k: s for k, s in zip(keys, resolved)
        if s and s.get("id") and s["id"] != seed.tmdb_id
    }

    # Upsert resolved movies (sequentially — the async session isn't concurrency
    # safe), then attach tmdbId + stub to every mention.
    from app.features.movies.movies import _upsert_movie

    upserted: set[int] = set()
    mentions: list[dict] = []
    for m in raw_mentions:
        stub = stub_by_key.get((m["title"].strip().lower(), m["year"]))
        if not stub:
            continue
        tid = stub["id"]
        if tid not in upserted:
            try:
                stub_for_upsert = {
                    **stub,
                    "genres": [{"id": gid, "name": ""} for gid in (stub.get("genre_ids") or [])],
                }
                async with db.begin_nested():
                    await _upsert_movie(db, stub_for_upsert)
                upserted.add(tid)
            except Exception as exc:  # noqa: BLE001
                print(f"[discovery] upsert failed for tmdb_id={tid}: {exc}")
                continue
        mentions.append({"tmdbId": tid, "source": m["source"], "stub": stub})

    if upserted:
        try:
            await db.flush()
        except Exception as exc:  # noqa: BLE001
            print(f"[discovery] flush failed: {exc}")
    return mentions


# ── Consensus reasoning ───────────────────────────────────────


async def _consensus_reasoning(
    seed: Movie, records: list[dict]
) -> tuple[str | None, dict[int, str]]:
    """One LLM call → the seed's community 'essence' + a one-line why per film,
    keyed by tmdbId. Falls back to (None, {}) when the LLM is unavailable; the
    caller then uses a generic explanation."""
    if not llm.is_available() or not records:
        return None, {}
    lines = []
    for g in records:
        stub = g.get("stub") or {}
        year = (stub.get("release_date") or "")[:4]
        title = stub.get("title") or ""
        lines.append(
            f"- tmdbId={g['tmdbId']}: {title}"
            + (f" ({year})" if year else "")
            + f" — recommended {g['mentionCount']}x across {len(g['sources'])} source(s)"
        )
    prompt = (
        f"The film community across Reddit, blogs and articles keeps recommending "
        f"these films to people who liked \"{seed.title}\" (ranked by how often and "
        "how widely they're cited):\n\n"
        + "\n".join(lines)
        + "\n\nFirst, in ONE sentence, name the shared viewing experience the "
        "community keeps pointing to — the feeling/tone/moral world, not the "
        "genre. Then for EACH film (by its tmdbId) give one plain-English line "
        "(max 14 words) on why the community recommends it after the seed — the "
        "shared FEELING, not the plot. Cover every tmdbId listed."
    )
    data = await llm.generate_json(prompt, response_schema=_CONSENSUS_SCHEMA)
    if not data:
        return None, {}
    why_by_tmdb: dict[int, str] = {}
    for f in data.get("films") or []:
        tid = f.get("tmdbId")
        why = (f.get("why") or "").strip()
        if isinstance(tid, int) and why:
            why_by_tmdb[tid] = why
    return (data.get("essence") or None), why_by_tmdb


# ── Build + cache ─────────────────────────────────────────────


def _community_text(docs: list[dict], *, max_chars: int = 3000) -> str:
    """Compact grounding blob for the essence engine: Reddit + blog text first
    (highest-signal), truncated. Empty when there's nothing worth passing."""
    order = {"reddit": 0, "blog": 1, "youtube": 2, "web": 3}
    ranked = sorted(docs, key=lambda d: order.get(d["source"], 9))
    out: list[str] = []
    total = 0
    for d in ranked:
        t = d["text"].strip()
        if not t:
            continue
        out.append(t)
        total += len(t)
        if total >= max_chars:
            break
    return "\n\n".join(out)[:max_chars]


async def _ground_essence(db: AsyncSession, seed: Movie, docs: list[dict]) -> None:
    """Refresh the essence-engine pool for this seed using the community corpus.
    Best-effort: any failure is swallowed so it never sinks the community build."""
    text = _community_text(docs)
    if not text:
        return
    try:
        await find_similar_films(db, seed.tmdb_id, media_type="movie", community_text=text)
    except Exception as exc:  # noqa: BLE001
        print(f"[discovery] essence grounding failed for {seed.tmdb_id}: {exc}")


async def build_community_pool(db: AsyncSession, seed: Movie) -> dict:
    """The expensive path: scrape → extract → score → reason → payload. Pure of
    caching (the callers persist). Returns a payload whose `candidates` may be
    empty when no community signal / no LLM is available."""
    docs = await _gather_documents(seed)
    mentions = await _extract_and_resolve(db, seed, docs)
    records = aggregate_mentions(mentions)[:_POOL_SIZE]

    # Feed the same gathered corpus into the essence engine so its "movies like X"
    # answer is grounded in real community talk too (best-effort — reuses the
    # corpus we already have, costs one extra LLM call, never blocks the pool).
    await _ground_essence(db, seed, docs)

    essence, why_by_tmdb = await _consensus_reasoning(seed, records)
    top_raw = records[0]["rawScore"] if records else 0.0

    candidates: list[dict] = []
    for g in records:
        stub = g.get("stub") or {}
        candidates.append({
            "tmdbId": g["tmdbId"],
            "title": stub.get("title") or "",
            "posterPath": stub.get("poster_path"),
            "releaseDate": stub.get("release_date"),
            "originalLanguage": stub.get("original_language"),
            "matchScore": match_score(g["rawScore"], top_raw),
            "explanation": why_by_tmdb.get(g["tmdbId"])
            or f"Frequently recommended after {seed.title}",
            "mentionCount": g["mentionCount"],
            "sources": g["sources"],
            "provenance": source_label(g["sources"]),
            "rawScore": round(g["rawScore"], 3),
        })

    return {
        "seed": {"tmdbId": seed.tmdb_id, "title": seed.title, "mediaType": "movie"},
        "essence": essence,
        "candidates": candidates,
        "total": len(candidates),
    }


async def _read_cache(db: AsyncSession, seed_tmdb_id: int) -> dict | None:
    row = await db.get(DiscoveryCache, (seed_tmdb_id, _current_month()))
    if row is not None and row.version == _COMMUNITY_VERSION and isinstance(row.payload, dict):
        return row.payload
    return None


async def _write_cache(db: AsyncSession, seed_tmdb_id: int, payload: dict) -> None:
    month = _current_month()
    row = await db.get(DiscoveryCache, (seed_tmdb_id, month))
    if row is None:
        db.add(DiscoveryCache(
            seed_tmdb_id=seed_tmdb_id, month=month,
            version=_COMMUNITY_VERSION, payload=payload,
        ))
    else:
        row.version = _COMMUNITY_VERSION
        row.payload = payload
    try:
        await db.flush()
    except Exception as exc:  # noqa: BLE001
        print(f"[discovery] cache persist failed for {seed_tmdb_id}: {exc}")


async def get_cached_consensus(db: AsyncSession, seed_tmdb_id: int) -> dict | None:
    """Request-path read: the cached community pool for this seed/month, or None
    on a miss (the route then serves the essence fallback + schedules a warm)."""
    return await _read_cache(db, seed_tmdb_id)


async def build_and_cache(db: AsyncSession, seed: Movie) -> dict:
    """Warm path: build the pool and persist it (only when it has real
    candidates, so a degraded run with no keys doesn't poison the cache)."""
    payload = await build_community_pool(db, seed)
    if payload["candidates"]:
        await _write_cache(db, seed.tmdb_id, payload)
    return payload


# ── Slicing (pure) ────────────────────────────────────────────


def consensus_slice(ordered: list[dict], *, offset: int = 0) -> dict:
    """Serve a tight window out of an ordered candidate list — the 5-film answer.
    Pure, so it's cheap on every request and unit-testable."""
    window = ordered[offset: offset + _ANSWER_SIZE]
    return {
        "answer": window,
        "poolSize": len(ordered),
        "offset": offset,
        "hasMore": offset + _ANSWER_SIZE < len(ordered),
    }
