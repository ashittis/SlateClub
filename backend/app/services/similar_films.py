"""
"Movies like X" — essence-reasoned recommendations.

The primary path asks the LLM to reason about the seed film's *essence* — the
viewing experience (tension, dark humour, moral ambiguity, escalation from
normal→chaotic, class/power, suspense-without-conventional-thriller) — the way
essence.md reasons about Parasite, and to NAME films that share that essence
across world cinema regardless of language. We resolve each named title via
TMDB, cache it, and display it with the LLM's connective-tissue "why".

When the LLM is unavailable we fall back to the genre+semantic cosine over our
local catalogue (the original behaviour), so the endpoint never breaks.

A final "More from the creator & cast" row surfaces other notable films from
the seed's director and top-billed actors.
"""

from __future__ import annotations

import asyncio
import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..integrations import tmdb
from ..ml.embeddings.taste_vector import cosine_similarity, movie_to_embedding
from ..ml.llm import openai_client as llm
from ..models.movie import Movie

# Mirror the ranker's fallback weights for these two signals
# (xgboost_ranker.py: content_score=0.15, semantic_similarity=0.20) so the
# cosine fallback stays aligned with how For-You weights them.
_W_CONTENT = 0.15
_W_SEMANTIC = 0.20

# Essence results are stable per (seed, language-combo), so cache the whole
# payload and skip the LLM + TMDB round-trips on repeat.
_ESSENCE_CACHE: dict[tuple, dict] = {}
_ESSENCE_TTL_SECONDS = 24 * 60 * 60
_ESSENCE_CACHE_MAX = 256

_ESSENCE_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "essence": {
            "type": "string",
            "description": "ONE sentence naming the shared viewing experience "
            "(the feeling/tone/moral world), not the genre.",
        },
        "films": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "year": {"type": ["integer", "null"]},
                    "why": {
                        "type": "string",
                        "description": "Max 6 words — the connective tissue, "
                        "e.g. 'class satire that curdles into dread'.",
                    },
                },
                "required": ["title", "why"],
            },
        },
    },
    "required": ["essence", "films"],
}


def _genre_names(movie: Movie) -> list[str]:
    out: list[str] = []
    for g in movie.genres or []:
        if isinstance(g, dict) and g.get("name"):
            out.append(g["name"])
    return out


def _seed_people(seed: Movie) -> tuple[str, list[tuple[int, str]]]:
    """Return (essence_credit_blurb, [(person_id, name), …]) — director first,
    then top-billed cast — read from the seed's raw TMDB credits."""
    credits = seed.credits or {}
    crew = credits.get("crew") or []
    cast = credits.get("cast") or []

    people: list[tuple[int, str]] = []
    director_name = ""
    for c in crew:
        if (c.get("job") or "") == "Director" and c.get("id"):
            director_name = c.get("name") or ""
            people.append((c["id"], director_name))
            break

    for member in sorted(cast, key=lambda m: m.get("order", 999))[:2]:
        if member.get("id"):
            people.append((member["id"], member.get("name") or ""))

    lead_names = [n for _, n in people[1:]]
    blurb = ", ".join(filter(None, [
        f"directed by {director_name}" if director_name else "",
        f"starring {', '.join(lead_names)}" if lead_names else "",
    ]))
    return blurb, people


# ── Essence (LLM) path ────────────────────────────────────────


def _essence_prompt(seed: Movie) -> str:
    year = (seed.release_date or "")[:4]
    genres = ", ".join(_genre_names(seed))
    blurb, _ = _seed_people(seed)
    overview = (seed.overview or "").strip()

    facts = "\n".join(filter(None, [
        f"Title: {seed.title}" + (f" ({year})" if year else ""),
        f"Genres: {genres}" if genres else "",
        blurb,
        f"Plot: {overview}" if overview else "",
    ]))

    return (
        "You recommend films by ESSENCE, not genre or nationality. Essence is "
        "the experience of watching a film: its tension and pacing, its tone "
        "(e.g. dark comedy), its moral ambiguity, whether it escalates from "
        "ordinary to chaotic, its take on class/power, the kind of suspense it "
        "creates. Two films with zero genre or country overlap can share an "
        "essence (Parasite and The Menu; The Social Network and Uncut Gems).\n\n"
        "Given this seed film:\n"
        f"{facts}\n\n"
        "First, in one sentence, name the seed's essence — the shared viewing "
        "experience. Then list ~30 real, well-known films that deliver that "
        "SAME essence, chosen PURELY by feel. Language is NOT a barrier: draw "
        "from ANY industry worldwide — Hollywood (English), Bollywood (Hindi), "
        "Kollywood (Tamil), Tollywood (Telugu), Mollywood (Malayalam), "
        "Sandalwood (Kannada), plus Korean, Japanese, European and others. "
        "Never let language limit the picks — include the closest matches "
        "whatever their language, and aim for a good spread across languages "
        "so the list is browsable. Order them closest-essence first. Exclude "
        "the seed itself. For each, give its real title, release year, and a "
        "<=6-word reason."
    )


async def _resolve_title(title: str, year: int | None) -> dict | None:
    """Search TMDB for a named title and return the best-matching stub."""
    try:
        resp = await tmdb.search_movies(title)
    except Exception as exc:  # noqa: BLE001
        print(f"[essence] search failed for {title!r}: {exc}")
        return None
    hits = resp.get("results") or []
    if not hits:
        return None

    def score(h: dict) -> tuple:
        h_title = (h.get("title") or "").strip().lower()
        exact = h_title == title.strip().lower()
        h_year = (h.get("release_date") or "")[:4]
        year_ok = bool(year) and h_year.isdigit() and abs(int(h_year) - year) <= 1
        return (exact, year_ok, h.get("popularity") or 0.0)

    return max(hits, key=score)


async def _essence_films(
    db: AsyncSession, seed: Movie, limit: int
) -> tuple[list[dict], str | None] | None:
    """LLM names a broad, language-diverse set of essence-similar films; we
    resolve them via TMDB and tag each with its original language so the client
    can filter by language without another LLM call. Returns
    (results, essence_summary) or None when unavailable / too few resolvable."""
    if not llm.is_available():
        return None

    data = await llm.generate_json(
        _essence_prompt(seed), response_schema=_ESSENCE_SCHEMA
    )
    films = (data or {}).get("films") or []
    if not films:
        return None

    # Resolve all titles concurrently (network-bound), then upsert sequentially
    # (the async DB session is not safe for concurrent writes).
    resolved = await asyncio.gather(
        *(_resolve_title(f.get("title", ""), f.get("year")) for f in films)
    )

    pairs = [
        (f, s) for f, s in zip(films, resolved)
        if s and s.get("id") and s["id"] != seed.tmdb_id
    ]

    from ..routes.movies import _upsert_movie

    out: list[dict] = []
    seen: set[int] = {seed.tmdb_id}
    for film, stub in pairs:
        if stub["id"] in seen:
            continue
        seen.add(stub["id"])
        try:
            stub["genres"] = [
                {"id": gid, "name": ""} for gid in (stub.get("genre_ids") or [])
            ]
            async with db.begin_nested():
                row = await _upsert_movie(db, stub)
        except Exception as exc:  # noqa: BLE001
            print(f"[essence] upsert failed for {stub.get('id')}: {exc}")
            continue
        rank = len(out)
        out.append({
            "tmdbId": row.tmdb_id,
            "title": row.title,
            "posterPath": row.poster_path,
            "releaseDate": row.release_date,
            "voteAverage": row.vote_average,
            "originalLanguage": row.original_language,
            "matchScore": max(80, 97 - rank),
            "explanation": (film.get("why") or "Shares the seed's essence").strip(),
        })
        if len(out) >= limit:
            break

    if len(out) < 4:  # too thin to trust — let the caller fall back
        return None
    try:
        await db.flush()
    except Exception as exc:  # noqa: BLE001
        print(f"[essence] flush failed: {exc}")
    return out, (data or {}).get("essence")


# ── Creator & cast row ────────────────────────────────────────


async def _creator_row(
    db: AsyncSession, seed: Movie, exclude_ids: set[int], limit: int = 6
) -> dict | None:
    """Other notable films from the seed's director + top-billed actors."""
    _, people = _seed_people(seed)
    if not people:
        return None

    async def _films_for(pid: int) -> list[dict]:
        try:
            credits = await tmdb.get_person_movie_credits(pid)
        except Exception:  # noqa: BLE001
            return []
        rows = [*(credits.get("cast") or []), *(credits.get("crew") or [])]
        return rows

    per_person = await asyncio.gather(*(_films_for(pid) for pid, _ in people))

    blocked = set(exclude_ids) | {seed.tmdb_id}
    buckets: list[list[dict]] = []
    for (pid, name), rows in zip(people, per_person):
        seen_local: set[int] = set()
        films: list[dict] = []
        for c in sorted(rows, key=lambda r: r.get("popularity") or 0, reverse=True):
            tid = c.get("id")
            if not tid or tid in blocked or tid in seen_local or not c.get("poster_path"):
                continue
            seen_local.add(tid)
            films.append({
                "tmdbId": tid,
                "title": c.get("title") or "",
                "posterPath": c.get("poster_path"),
                "releaseDate": c.get("release_date"),
                "voteAverage": c.get("vote_average"),
                "matchScore": 0,
                "explanation": f"More from {name}" if name else "More from the cast",
            })
        buckets.append(films)

    # Round-robin across people so the row mixes director + each lead.
    out: list[dict] = []
    picked: set[int] = set()
    for i in range(max((len(b) for b in buckets), default=0)):
        for b in buckets:
            if i < len(b) and b[i]["tmdbId"] not in picked:
                picked.add(b[i]["tmdbId"])
                out.append(b[i])
                if len(out) >= limit:
                    break
        if len(out) >= limit:
            break

    if not out:
        return None
    return {"label": "More from the creator & cast", "results": out}


# ── Orchestrator ──────────────────────────────────────────────


async def find_similar_films(
    db: AsyncSession, seed_tmdb_id: int, limit: int = 30
) -> dict:
    """Essence-reasoned 'movies like X' with a director/cast row.

    Makes ONE LLM call returning a broad, language-diverse set (each film tagged
    with its original language) so the client can filter by language without
    re-calling. Falls back to the cosine ranking when the LLM is unavailable.
    Cached per seed.
    """
    from ..routes.movies import _get_or_fetch_movie

    seed = await _get_or_fetch_movie(seed_tmdb_id, db)

    cached = _ESSENCE_CACHE.get(seed_tmdb_id)
    if cached and (time.time() - cached["_ts"]) < _ESSENCE_TTL_SECONDS:
        return {k: v for k, v in cached.items() if not k.startswith("_")}

    essence_summary: str | None = None
    results: list[dict] | None = None

    essence = await _essence_films(db, seed, limit)
    if essence is not None:
        results, essence_summary = essence

    if results is None:
        # Fallback: genre + semantic cosine over the broadened local catalogue.
        await _hydrate_seed_neighbours(db, seed_tmdb_id)
        results = _cosine_similar_films(db, seed, limit, await _all_movies(db))

    creator_row = await _creator_row(db, seed, {r["tmdbId"] for r in results})

    payload = {
        "seed": {"tmdbId": seed.tmdb_id, "title": seed.title},
        "essence": essence_summary,
        "results": results,
        "creatorRow": creator_row,
        "total": len(results),
    }

    if len(_ESSENCE_CACHE) >= _ESSENCE_CACHE_MAX:
        _ESSENCE_CACHE.pop(next(iter(_ESSENCE_CACHE)))
    _ESSENCE_CACHE[seed_tmdb_id] = {**payload, "_ts": time.time()}
    return payload


# ── Cosine fallback (original behaviour) ──────────────────────


async def _all_movies(db: AsyncSession) -> list[Movie]:
    return list((await db.execute(select(Movie))).scalars().all())


def _cosine_similar_films(
    db: AsyncSession, seed: Movie, limit: int, candidates: list[Movie],
) -> list[dict]:
    seed_vec = movie_to_embedding(_movie_to_emb_dict(seed))
    seed_identity = llm.deserialize_embedding(seed.identity_embedding)

    scored: list[tuple[Movie, float]] = []
    for cand in candidates:
        if cand.id == seed.id or cand.tmdb_id == seed.tmdb_id:
            continue
        content_sim = cosine_similarity(seed_vec, movie_to_embedding(_movie_to_emb_dict(cand)))
        cand_identity = llm.deserialize_embedding(cand.identity_embedding)
        if seed_identity is not None and cand_identity is not None:
            semantic_sim = cosine_similarity(seed_identity, cand_identity)
            score = (_W_CONTENT * content_sim + _W_SEMANTIC * semantic_sim) / (
                _W_CONTENT + _W_SEMANTIC
            )
        else:
            score = content_sim
        scored.append((cand, score))

    scored.sort(key=lambda x: -x[1])
    seed_genres = set(_genre_names(seed))
    out: list[dict] = []
    for m, score in scored[:limit]:
        shared = [g for g in _genre_names(m) if g in seed_genres]
        out.append({
            "tmdbId": m.tmdb_id,
            "title": m.title,
            "posterPath": m.poster_path,
            "releaseDate": m.release_date,
            "voteAverage": m.vote_average,
            "originalLanguage": m.original_language,
            "matchScore": int(round(max(0.0, min(score, 1.0)) * 100)),
            "explanation": ("Shares " + " · ".join(shared[:2])) if shared
            else f"Similar tone to {seed.title}",
        })
    return out


async def _hydrate_seed_neighbours(db: AsyncSession, seed_tmdb_id: int) -> int:
    """Pull the seed's TMDB recommendations + similar films and upsert them so
    they become rankable candidates for the cosine fallback. Defensive."""
    from ..routes.movies import _upsert_movie

    added = 0
    for fetch in (tmdb.get_movie_recommendations, tmdb.get_movie_similar):
        try:
            resp = await fetch(seed_tmdb_id)
        except Exception as exc:  # noqa: BLE001
            print(f"[similar] TMDB {fetch.__name__} failed for {seed_tmdb_id}: {exc}")
            continue
        for raw in (resp.get("results") or []):
            try:
                raw["genres"] = [
                    {"id": gid, "name": ""} for gid in (raw.get("genre_ids") or [])
                ]
                async with db.begin_nested():
                    await _upsert_movie(db, raw)
                added += 1
            except Exception as exc:  # noqa: BLE001
                print(f"[similar] upsert failed for tmdb_id={raw.get('id')}: {exc}")
                continue
    if added:
        try:
            await db.flush()
        except Exception as exc:  # noqa: BLE001
            print(f"[similar] flush failed: {exc}")
    return added


def _movie_to_emb_dict(movie: Movie) -> dict:
    """The subset of fields movie_to_embedding() reads."""
    return {
        "id": movie.id,
        "genres": movie.genres,
        "vote_average": movie.vote_average,
        "popularity": movie.popularity,
        "runtime": movie.runtime,
        "release_date": movie.release_date,
        "original_language": movie.original_language,
    }
