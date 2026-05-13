"""Movie Understanding extractor.

Turns TMDB metadata (plot, cast, genres, etc.) into a structured
`MovieIdentity` via Gemini, then embeds the identity summary so movies
become searchable in semantic space.

A7a scope: TMDB-only inputs. Reddit/Letterboxd ingestion is left as a
clearly-marked extension point (`_external_sources_for`) so plugging
those in later is a one-file change.

Run offline via scripts/extract_movie_identities.py — never on the
request path.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from . import gemini_client


# Output shape we ask Gemini to produce. Kept stable so the embedding
# input + downstream code can rely on the same fields.
IDENTITY_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "vibe": {"type": "string"},
        "themes": {"type": "array", "items": {"type": "string"}},
        "audience": {"type": "string"},
        "comparable_films": {"type": "array", "items": {"type": "string"}},
        "tone_axes": {
            "type": "object",
            "properties": {
                "pace": {"type": "number"},
                "realism": {"type": "number"},
                "emotional_register": {"type": "string"},
            },
        },
        "audience_warnings": {"type": "array", "items": {"type": "string"}},
        "summary_paragraph": {"type": "string"},
    },
    "required": [
        "vibe",
        "themes",
        "audience",
        "comparable_films",
        "summary_paragraph",
    ],
}


def _external_sources_for(movie: dict) -> str:
    """Hook for Reddit/Letterboxd/critic ingestion (A7b).

    Returns extra grounding text appended to the Gemini prompt. Today
    this is a stub that returns "" — the architecture is ready for
    plugging in scrapers without changing the extractor or schema.
    """
    return ""


def _build_prompt(movie: dict) -> str:
    title = movie.get("title") or "Unknown"
    overview = (movie.get("overview") or "").strip()
    release = (movie.get("release_date") or "")[:4]
    runtime = movie.get("runtime")
    lang = movie.get("original_language") or "en"

    genres = movie.get("genres") or []
    genre_names = [
        g.get("name") for g in genres if isinstance(g, dict) and g.get("name")
    ]

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

    extras = _external_sources_for(movie)

    sections = [
        f"Title: {title} ({release})" if release else f"Title: {title}",
        f"Original language: {lang}",
        f"Runtime: {runtime} min" if runtime else None,
        f"Genres: {', '.join(genre_names)}" if genre_names else None,
        f"Director: {director}" if director else None,
        f"Cast: {', '.join(cast_names)}" if cast_names else None,
        f"Plot: {overview}" if overview else None,
    ]
    sections = [s for s in sections if s]
    movie_block = "\n".join(sections)

    return (
        "You are a film-literate editor profiling movies for a "
        "recommendation engine. Read the metadata below and produce a "
        "structured identity that captures the film's essence beyond "
        "its genre tags. Be specific. Avoid generic phrases.\n\n"
        "Fields:\n"
        "- vibe: 1 line describing the film's overall feel (e.g. \"slow, "
        "melancholic, introspective\").\n"
        "- themes: 3-5 short noun phrases (e.g. \"grief\", \"memory\").\n"
        "- audience: 1 line describing who would love this film, "
        "framed in terms of other films/directors they like.\n"
        "- comparable_films: 3-5 actual films a fan of this would "
        "also enjoy. Use exact titles.\n"
        "- tone_axes: pace (0=glacial, 1=breakneck), realism (0=stylised, "
        "1=grounded), emotional_register (one word: e.g. \"subdued\", "
        "\"euphoric\", \"dread\").\n"
        "- audience_warnings: short notes for viewers (\"slow first act\", "
        "\"non-linear\"). Keep it short or empty.\n"
        "- summary_paragraph: 2-3 sentences capturing what makes this "
        "film distinctive. Used as the embedded representation, so "
        "pack it with semantic signal.\n\n"
        f"Movie:\n{movie_block}\n"
        + (f"\nAdditional context:\n{extras}\n" if extras else "")
    )


def _embedding_input(identity: dict) -> str:
    """Build the text we feed to the embedding model.

    Concatenating the high-signal fields gives much richer semantic
    matching than the summary paragraph alone.
    """
    parts = [
        identity.get("summary_paragraph") or "",
        f"Vibe: {identity.get('vibe', '')}",
        f"Themes: {', '.join(identity.get('themes') or [])}",
        f"Audience: {identity.get('audience', '')}",
        f"Comparable films: {', '.join(identity.get('comparable_films') or [])}",
    ]
    return "\n".join(p for p in parts if p.strip())


async def extract_identity(movie: dict) -> dict | None:
    """Extract MovieIdentity for one movie. Returns the dict or None
    if Gemini is unavailable or the call failed."""
    if not gemini_client.is_available():
        return None
    prompt = _build_prompt(movie)
    return await gemini_client.generate_json(
        prompt, response_schema=IDENTITY_SCHEMA
    )


async def extract_and_embed(movie: dict) -> tuple[dict | None, bytes | None]:
    """Run extraction + embedding for one movie. Returns
    (identity_json, embedding_bytes). Either may be None on failure;
    the caller should persist what it can."""
    identity = await extract_identity(movie)
    if identity is None:
        return None, None

    embed_text = _embedding_input(identity)
    if not embed_text:
        return identity, None

    vec = await gemini_client.embed(embed_text, task_type="RETRIEVAL_DOCUMENT")
    if vec is None:
        return identity, None

    return identity, gemini_client.serialize_embedding(vec)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
