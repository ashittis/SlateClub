"""
backend/app/ml/llm/movie_identity.py  — UPGRADED (affect-first)

Offline batch enrichment of each Movie with a SEMANTIC IDENTITY that captures
"what it feels like to watch the film" — not what it is about.

Design intent (vs. the old themes/genre-leaning identity):
  - The embedding is computed from an AFFECT-WEIGHTED text where the
    second-person "experiential paragraph" leads and is repeated, so the vector
    is pulled toward how the film *plays on the viewer's nervous system*.
  - A 9-axis structured affect profile is stored inside identity_json so the
    ranker can compute an interpretable `affect_axis_match` feature and the
    explanation layer can name the shared "essence" between films.

This is why The Social Network and Uncut Gems land next to each other:
their genres/directors/casts share nothing, but their AFFECT signatures
(relentless propulsion, escalating loss-of-control, abrasive texture,
unresolved dread) are nearly identical.

NEVER runs on the request path. Invoked from scripts/extract_movie_identities.py.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.ml.llm.gemini_client import GeminiClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Affect rubric — the dimensions that separate films by *experience*, not topic.
# Each axis is a float in [-1, 1]. The poles are written so the LLM can anchor.
# Order is fixed: it defines the layout of the packed affect vector.
# ---------------------------------------------------------------------------
AFFECT_AXES: list[dict] = [
    {"key": "tension",     "neg": "serene, relaxed",            "pos": "white-knuckle, anxious"},
    {"key": "propulsion",  "neg": "languid, drifting",          "pos": "relentless, driving"},
    {"key": "control",     "neg": "grounded, stable",           "pos": "spiraling out of control"},
    {"key": "valence",     "neg": "despairing, bleak",          "pos": "euphoric, uplifting"},
    {"key": "texture",     "neg": "clean, composed",            "pos": "abrasive, overstimulating"},
    {"key": "scale",       "neg": "claustrophobic, intimate",   "pos": "expansive, epic"},
    {"key": "cognition",   "neg": "effortless, easy to follow", "pos": "demanding, puzzle-like"},
    {"key": "resolution",  "neg": "cathartic release",          "pos": "unresolved, lingering dread"},
    {"key": "warmth",      "neg": "cold, clinical",             "pos": "tender, humane"},
]
AFFECT_KEYS = [a["key"] for a in AFFECT_AXES]


# JSON schema handed to gemini_client.generate_json()
IDENTITY_SCHEMA = {
    "type": "object",
    "properties": {
        "experiential_paragraph": {
            "type": "string",
            "description": (
                "2-3 sentences, SECOND PERSON, describing the bodily/emotional "
                "experience of watching this film. Focus on how it makes the "
                "viewer FEEL moment to moment, not the plot. "
                "e.g. 'Your stomach stays clenched the whole way; every scene "
                "tightens the screw a little further.'"
            ),
        },
        "vibe": {"type": "string", "description": "1-line overall feel."},
        "affect_axes": {
            "type": "object",
            "description": "Each value a float in [-1, 1].",
            "properties": {k: {"type": "number"} for k in AFFECT_KEYS},
            "required": AFFECT_KEYS,
        },
        "themes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-5 semantic noun phrases (content, not feeling).",
        },
        "comparable_by_feel": {
            "type": "array",
            "items": {"type": "string"},
            "description": (
                "3-5 real film titles that produce a SIMILAR VIEWING EXPERIENCE, "
                "even if they share no genre/director/cast."
            ),
        },
    },
    "required": ["experiential_paragraph", "vibe", "affect_axes", "themes", "comparable_by_feel"],
}


def _build_prompt(movie: Movie) -> str:
    director = ""
    cast = ""
    try:
        credits = movie.credits or {}
        director = (credits.get("director") or {}).get("name", "")
        cast = ", ".join(p.get("name", "") for p in (credits.get("cast") or [])[:5])
    except Exception:
        pass
    genres = ", ".join(g.get("name", "") for g in (movie.genres or []))

    axes_doc = "\n".join(
        f"  - {a['key']}: -1 = {a['neg']}  ...  +1 = {a['pos']}" for a in AFFECT_AXES
    )
    return f"""You are a film phenomenologist. Describe the EXPERIENCE of watching this film,
not its plot or pedigree. Two films can share zero genre/director/cast and still feel
identical to sit through (e.g. The Social Network and Uncut Gems both run on relentless,
escalating, anxious loss-of-control). Capture THAT.

FILM
  Title: {movie.title}
  Year: {getattr(movie, 'release_date', '') or ''}
  Runtime: {movie.runtime or '?'} min
  Genres: {genres}
  Director: {director}
  Cast: {cast}
  Synopsis: {movie.overview or ''}

Rate these affect axes, each a float in [-1, 1]:
{axes_doc}

Return ONLY JSON matching the provided schema. No prose, no markdown fences."""


def _embedding_text(identity: dict) -> str:
    """
    Compose the text we embed. AFFECT LEADS and REPEATS so the resulting vector
    is dominated by viewing-experience rather than subject matter. Themes and
    comparables come last as light context.
    """
    para = identity.get("experiential_paragraph", "")
    vibe = identity.get("vibe", "")
    themes = ", ".join(identity.get("themes", []))
    comps = ", ".join(identity.get("comparable_by_feel", []))
    # Lead + repeat the experiential signal; trail with weaker content signal.
    return (
        f"{para}\n{vibe}\n{para}\n"
        f"Feels like: {comps}.\n"
        f"Themes: {themes}."
    )


def _pack_affect_vector(affect_axes: dict) -> bytes:
    """9-dim structured affect vector, packed as float32 bytes."""
    vec = np.array([float(affect_axes.get(k, 0.0)) for k in AFFECT_KEYS], dtype=np.float32)
    # clip to the declared range in case the model drifts
    vec = np.clip(vec, -1.0, 1.0)
    return vec.tobytes()


async def extract_identity(movie: Movie, gemini: GeminiClient) -> dict | None:
    """Run the LLM, return the identity dict augmented with the packed vectors.
    Returns None on failure so the batch runner can skip-and-continue."""
    try:
        identity = await gemini.generate_json(_build_prompt(movie), schema=IDENTITY_SCHEMA)
    except Exception as e:  # noqa: BLE001
        logger.warning("identity extraction failed for %s: %s", movie.title, e)
        return None
    if not identity:
        return None

    # Semantic essence embedding (affect-weighted text). Documents use RETRIEVAL_DOCUMENT.
    emb = await gemini.embed(_embedding_text(identity), task_type="RETRIEVAL_DOCUMENT")
    if emb is None:
        return None
    identity["_embedding_bytes"] = np.asarray(emb, dtype=np.float32).tobytes()
    identity["_affect_bytes"] = _pack_affect_vector(identity.get("affect_axes", {}))
    return identity


async def extract_and_store(movie: Movie, gemini: GeminiClient, session: AsyncSession) -> bool:
    identity = await extract_identity(movie, gemini)
    if identity is None:
        return False

    emb_bytes = identity.pop("_embedding_bytes")
    affect_bytes = identity.pop("_affect_bytes")

    # Migration-free: keep identity_embedding for the semantic feature, stash the
    # structured affect vector inside identity_json (base64-free: store the floats).
    identity["affect_vector"] = [float(x) for x in np.frombuffer(affect_bytes, dtype=np.float32)]

    movie.identity_json = identity
    movie.identity_embedding = emb_bytes
    movie.identity_updated_at = datetime.now(timezone.utc)
    await session.flush()
    return True


async def run_batch(session: AsyncSession, gemini: GeminiClient,
                    limit: int | None = None, only_missing: bool = True) -> dict:
    """Batch entry point for scripts/extract_movie_identities.py."""
    stmt = select(Movie)
    if only_missing:
        stmt = stmt.where(Movie.identity_embedding.is_(None))
    if limit:
        stmt = stmt.limit(limit)

    movies = (await session.execute(stmt)).scalars().all()
    ok, fail = 0, 0
    for i, movie in enumerate(movies, 1):
        success = await extract_and_store(movie, gemini, session)
        ok += int(success)
        fail += int(not success)
        if i % 25 == 0:
            await session.commit()
            logger.info("identities: %d/%d (ok=%d fail=%d)", i, len(movies), ok, fail)
    await session.commit()
    logger.info("identity batch done: ok=%d fail=%d", ok, fail)
    return {"processed": len(movies), "ok": ok, "fail": fail}
