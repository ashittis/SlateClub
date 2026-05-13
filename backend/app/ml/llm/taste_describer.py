"""LLM Semantic Taste Alignment — Layer 4 (ARCHITECTURE.md Section 1.3)

Uses Gemini to generate natural-language taste descriptions and
extract cinematic tone tags.
"""

from __future__ import annotations

from . import gemini_client


_TONE_AXES_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "pace": {"type": "string"},
        "tone": {"type": "string"},
        "structure": {"type": "string"},
        "perspective": {"type": "string"},
        "emotional_register": {"type": "string"},
    },
    "required": [
        "pace",
        "tone",
        "structure",
        "perspective",
        "emotional_register",
    ],
}


_DEFAULT_TONE_TAGS = {
    "pace": "measured",
    "tone": "warm",
    "structure": "linear",
    "perspective": "omniscient",
    "emotional_register": "contemplative",
}


async def generate_taste_description(
    reviews: list[dict],
    top_rated_movies: list[str],
    favorite_genres: list[str],
    favorite_directors: list[str],
) -> str:
    """Generate a 2-3 sentence taste description.

    Returns a fallback string if Gemini is unavailable so callers
    never have to special-case the no-key path.
    """
    if not gemini_client.is_available():
        return "Not enough data to generate a taste description yet."

    review_texts = "\n".join(
        f"- {r.get('movie_title', 'Unknown')}: \"{r.get('body', '')}\""
        for r in reviews[:20]
    )

    prompt = (
        "Based on these film reviews and preferences, describe this "
        "person's cinematic taste in 2-3 sentences. Focus on tone, "
        "storytelling style, pacing, and themes they gravitate "
        "toward. Be specific and evocative — avoid generic statements. "
        "Return only the description, no quotes or markdown.\n\n"
        f"Reviews:\n{review_texts if review_texts else '(No reviews yet)'}\n\n"
        f"Top rated films: {', '.join(top_rated_movies[:15]) if top_rated_movies else 'Not enough data'}\n"
        f"Favorite genres: {', '.join(favorite_genres[:5]) if favorite_genres else 'Unknown'}\n"
        f"Favorite directors: {', '.join(favorite_directors[:5]) if favorite_directors else 'Unknown'}\n"
    )

    text = await gemini_client.generate_text(
        prompt, temperature=0.5, max_output_tokens=220
    )
    return text or "Not enough data to generate a taste description yet."


async def extract_tone_tags(
    title: str,
    overview: str,
    genres: list[str],
) -> dict:
    """Classify a film on 5 cinematic dimensions. Returns the default
    tag set if Gemini is unavailable or the call fails."""
    if not gemini_client.is_available():
        return dict(_DEFAULT_TONE_TAGS)

    prompt = (
        "Classify this film on the cinematic dimensions below. Return "
        "JSON with exactly these keys, each with one value from the "
        "allowed list.\n\n"
        f"Film: {title}\n"
        f"Overview: {overview}\n"
        f"Genres: {', '.join(genres)}\n\n"
        "Dimensions:\n"
        "- pace: slow-burn | measured | kinetic\n"
        "- tone: dark | warm | cold | dreamlike | absurd\n"
        "- structure: linear | nonlinear | episodic | circular\n"
        "- perspective: unreliable-narrator | omniscient | intimate\n"
        "- emotional_register: cathartic | unsettling | contemplative | exhilarating\n"
    )

    out = await gemini_client.generate_json(
        prompt, response_schema=_TONE_AXES_SCHEMA, temperature=0.2
    )
    if not isinstance(out, dict):
        return dict(_DEFAULT_TONE_TAGS)
    # Fill any missing keys from the default so downstream code is
    # never tripped up by a partial response.
    for k, v in _DEFAULT_TONE_TAGS.items():
        out.setdefault(k, v)
    return out


async def embed_taste_statement(statement: str):
    """Embed a user's taste statement so it can be cosine-matched
    against movie identity embeddings at request time. Returns the
    np.ndarray or None when Gemini is unavailable."""
    if not statement or not gemini_client.is_available():
        return None
    return await gemini_client.embed(statement, task_type="RETRIEVAL_QUERY")
