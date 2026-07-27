"""
Taste Identity Profile (ARCHITECTURE.md Section 1.4)

Computes a user-facing taste fingerprint with:
- Primary axes (pace, tone, structure, perspective)
- Genre blend ("Psychological Thriller × Slow Cinema × Neo-Noir")
- Director affinities
- Taste statement (LLM-generated)
- Tribe memberships
"""

from app.ml.llm.taste_describer import generate_taste_description


async def compute_taste_identity(
    user_id: str,
    ratings: list[dict],
    reviews: list[dict],
    favorite_people: list[dict],
    clusters: list[dict],
) -> dict:
    """
    Compute the full Taste Identity Profile for a user.

    Returns the taste_identity JSON structure from Section 1.4.
    """
    # 1. Primary axes — derived from user's top-rated films' tone tags
    primary_axes = _compute_primary_axes(ratings)

    # 2. Genre blend — top 3 genres formatted as compound label
    genre_blend = _compute_genre_blend(ratings)

    # 3. Director affinities — from favorite people + highly-rated directors
    director_affinities = _compute_director_affinities(ratings, favorite_people)

    # 4. Taste statement — LLM-generated
    top_rated_titles = [
        r.get("movie_title", "") for r in sorted(ratings, key=lambda x: -x.get("value", 0))[:15]
    ]
    favorite_genres = list(set(
        g for r in ratings for g in (r.get("genres", []) or [])
        if isinstance(g, str)
    ))[:5]
    fav_directors = [p.get("name", "") for p in favorite_people if p.get("known_for") == "Directing"]

    try:
        taste_statement = await generate_taste_description(
            reviews=reviews,
            top_rated_movies=top_rated_titles,
            favorite_genres=favorite_genres if favorite_genres else [genre_blend],
            favorite_directors=fav_directors,
        )
    except Exception:
        taste_statement = "Not enough data to generate a taste description yet."

    # 5. Tribes
    tribes = [
        f"{c.get('cluster_name', 'Unknown')} ({'primary' if i == 0 else 'secondary'})"
        for i, c in enumerate(clusters[:3])
    ]

    return {
        "primary_axes": primary_axes,
        "genre_blend": genre_blend,
        "director_affinities": director_affinities,
        "taste_statement": taste_statement,
        "tribes": tribes,
    }


def _compute_primary_axes(ratings: list[dict]) -> list[dict]:
    """Compute primary taste axes from rated films' genres."""
    # Map genres to taste dimensions
    genre_to_pace = {27: "slow-burn", 53: "slow-burn", 28: "kinetic", 12: "kinetic", 18: "measured"}
    genre_to_tone = {27: "dark", 53: "dark", 80: "cold", 35: "warm", 14: "dreamlike", 16: "warm"}

    pace_counts: dict[str, float] = {}
    tone_counts: dict[str, float] = {}

    for r in ratings:
        weight = r.get("value", 3) / 5.0
        genres = r.get("genres") or []
        for g in genres:
            gid = g.get("id") if isinstance(g, dict) else g
            if gid in genre_to_pace:
                p = genre_to_pace[gid]
                pace_counts[p] = pace_counts.get(p, 0) + weight
            if gid in genre_to_tone:
                t = genre_to_tone[gid]
                tone_counts[t] = tone_counts.get(t, 0) + weight

    axes = []
    if pace_counts:
        top_pace = max(pace_counts, key=pace_counts.get)  # type: ignore
        total = sum(pace_counts.values())
        axes.append({"dimension": "pace", "position": top_pace, "strength": round(pace_counts[top_pace] / total, 2)})

    if tone_counts:
        top_tone = max(tone_counts, key=tone_counts.get)  # type: ignore
        total = sum(tone_counts.values())
        axes.append({"dimension": "tone", "position": top_tone, "strength": round(tone_counts[top_tone] / total, 2)})

    return axes


def _compute_genre_blend(ratings: list[dict]) -> str:
    """Top 3 genres formatted as 'X × Y × Z'."""
    genre_counts: dict[str, float] = {}
    for r in ratings:
        weight = r.get("value", 3) / 5.0
        for g in (r.get("genres") or []):
            name = g.get("name") if isinstance(g, dict) else str(g)
            if name:
                genre_counts[name] = genre_counts.get(name, 0) + weight

    top = sorted(genre_counts.items(), key=lambda x: -x[1])[:3]
    return " × ".join(name for name, _ in top) if top else "Exploring"


def _compute_director_affinities(ratings: list[dict], favorite_people: list[dict]) -> list[dict]:
    """Compute director affinity scores."""
    director_scores: dict[str, list[float]] = {}

    for r in ratings:
        credits = r.get("credits") or {}
        director = credits.get("director") if isinstance(credits, dict) else None
        if director and isinstance(director, dict):
            name = director.get("name", "")
            if name:
                director_scores.setdefault(name, []).append(r.get("value", 3))

    # Add favorite people who are directors
    for p in favorite_people:
        if p.get("known_for") == "Directing":
            name = p.get("name", "")
            if name and name not in director_scores:
                director_scores[name] = [4.0]  # assumed affinity

    affinities = []
    for name, scores in director_scores.items():
        avg = sum(scores) / len(scores)
        affinities.append({"name": name, "affinity": round(avg / 5.0, 2)})

    affinities.sort(key=lambda x: -x["affinity"])
    return affinities[:5]
