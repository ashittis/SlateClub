"""Affect-first movie identity extractor.

Turns TMDB metadata into a structured identity that captures *what it feels
like to watch the film* — not what it's about. Two films can share zero
genre/director/cast and still feel identical to sit through (The Social
Network and Uncut Gems both run on relentless, escalating, anxious
loss-of-control). The 9-axis affect rubric below captures that, and the
embedding text leads with and repeats a second-person experiential paragraph
so the resulting vector is dominated by viewing-experience rather than topic.

Public surface (kept stable so scripts/extract_movie_identities.py doesn't
change):
  - IDENTITY_SCHEMA, extract_identity(movie_dict),
    extract_and_embed(movie_dict) -> (dict, bytes), now_utc()

Returned identity dict additionally carries:
  - "affect_vector": list[float]  (9 floats in [-1, 1], order = AFFECT_KEYS)
Downstream code (the anchors endpoint, the Stage-3 ranker) reads this field.

Run offline via scripts/extract_movie_identities.py — never on the request path.
"""

from __future__ import annotations

from datetime import datetime, timezone

from . import openai_client as llm


# 9 axes that separate films by *experience*, not topic. Each is float in
# [-1, 1]. The order here defines the layout of affect_vector.
AFFECT_AXES: list[dict] = [
    {"key": "tension",    "neg": "serene, relaxed",            "pos": "white-knuckle, anxious"},
    {"key": "propulsion", "neg": "languid, drifting",          "pos": "relentless, driving"},
    {"key": "control",    "neg": "grounded, stable",           "pos": "spiraling out of control"},
    {"key": "valence",    "neg": "despairing, bleak",          "pos": "euphoric, uplifting"},
    {"key": "texture",    "neg": "clean, composed",            "pos": "abrasive, overstimulating"},
    {"key": "scale",      "neg": "claustrophobic, intimate",   "pos": "expansive, epic"},
    {"key": "cognition",  "neg": "effortless, easy to follow", "pos": "demanding, puzzle-like"},
    {"key": "resolution", "neg": "cathartic release",          "pos": "unresolved, lingering dread"},
    {"key": "warmth",     "neg": "cold, clinical",             "pos": "tender, humane"},
]
AFFECT_KEYS: list[str] = [a["key"] for a in AFFECT_AXES]


IDENTITY_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "experiential_paragraph": {
            "type": "string",
            "description": (
                "2-3 sentences, SECOND PERSON, describing the bodily/"
                "emotional experience of watching this film. Focus on how "
                "it makes the viewer FEEL moment to moment, not the plot. "
                "e.g. 'Your stomach stays clenched the whole way; every "
                "scene tightens the screw a little further.'"
            ),
        },
        "vibe": {"type": "string"},
        "affect_axes": {
            "type": "object",
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
                "3-5 real film titles that produce a SIMILAR VIEWING "
                "EXPERIENCE, even if they share no genre/director/cast."
            ),
        },
    },
    "required": [
        "experiential_paragraph",
        "vibe",
        "affect_axes",
        "themes",
        "comparable_by_feel",
    ],
}


def _build_prompt(movie: dict) -> str:
    title = movie.get("title") or "Unknown"
    overview = (movie.get("overview") or "").strip()
    release = (movie.get("release_date") or "")[:4]
    runtime = movie.get("runtime")
    lang = movie.get("original_language") or "en"

    genres = movie.get("genres") or []
    genre_names = [g.get("name") for g in genres if isinstance(g, dict) and g.get("name")]

    credits = movie.get("credits") or {}
    director = ""
    cast_names: list[str] = []
    if isinstance(credits, dict):
        d = credits.get("director")
        if isinstance(d, dict):
            director = d.get("name", "") or ""
        cast = credits.get("cast") or []
        for member in cast[:5]:
            if isinstance(member, dict) and member.get("name"):
                cast_names.append(member["name"])

    axes_doc = "\n".join(
        f"  - {a['key']}: -1 = {a['neg']}  ...  +1 = {a['pos']}" for a in AFFECT_AXES
    )

    sections = [
        f"Title: {title} ({release})" if release else f"Title: {title}",
        f"Original language: {lang}",
        f"Runtime: {runtime} min" if runtime else None,
        f"Genres: {', '.join(genre_names)}" if genre_names else None,
        f"Director: {director}" if director else None,
        f"Cast: {', '.join(cast_names)}" if cast_names else None,
        f"Plot: {overview}" if overview else None,
    ]
    movie_block = "\n".join(s for s in sections if s)

    return (
        "You are a film phenomenologist. Describe the EXPERIENCE of watching "
        "this film, not its plot or pedigree. Two films can share zero "
        "genre/director/cast and still feel identical to sit through "
        "(e.g. The Social Network and Uncut Gems both run on relentless, "
        "escalating, anxious loss-of-control). Capture THAT.\n\n"
        "Rate these affect axes, each a float in [-1, 1]:\n"
        f"{axes_doc}\n\n"
        f"Movie:\n{movie_block}\n\n"
        "Return ONLY JSON matching the provided schema. No prose, no "
        "markdown fences."
    )


def _embedding_text(identity: dict) -> str:
    """Compose the text we embed.

    Affect leads and repeats so the resulting vector is dominated by
    viewing-experience rather than subject matter. Themes and comparables
    come last as light context.
    """
    para = identity.get("experiential_paragraph", "")
    vibe = identity.get("vibe", "")
    themes = ", ".join(identity.get("themes") or [])
    comps = ", ".join(identity.get("comparable_by_feel") or [])
    return (
        f"{para}\n{vibe}\n{para}\n"
        f"Feels like: {comps}.\n"
        f"Themes: {themes}."
    )


def _pack_affect_floats(affect_axes: dict) -> list[float]:
    """9 floats clipped to [-1, 1] in the canonical AFFECT_KEYS order."""
    out: list[float] = []
    for k in AFFECT_KEYS:
        try:
            v = float(affect_axes.get(k, 0.0))
        except (TypeError, ValueError):
            v = 0.0
        out.append(max(-1.0, min(1.0, v)))
    return out


async def extract_identity(movie: dict) -> dict | None:
    """Extract MovieIdentity for one movie. Returns the dict or None if
    OpenAI is unavailable or the call failed."""
    if not llm.is_available():
        return None
    prompt = _build_prompt(movie)
    return await llm.generate_json(prompt, response_schema=IDENTITY_SCHEMA)


async def extract_and_embed(movie: dict) -> tuple[dict | None, bytes | None]:
    """Run extraction + embedding for one movie.

    Returns (identity_json, embedding_bytes). Either may be None on failure;
    the caller should persist what it can. The returned identity dict
    additionally contains "affect_vector": list[float] (9 floats).
    """
    identity = await extract_identity(movie)
    if identity is None:
        return None, None

    identity["affect_vector"] = _pack_affect_floats(identity.get("affect_axes") or {})

    embed_text = _embedding_text(identity)
    if not embed_text.strip():
        return identity, None

    vec = await llm.embed(embed_text, task_type="RETRIEVAL_DOCUMENT")
    if vec is None:
        return identity, None

    return identity, llm.serialize_embedding(vec)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
