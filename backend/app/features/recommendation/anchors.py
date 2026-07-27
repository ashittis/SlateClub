"""Anchor-film recommendation endpoint.

User names 2-4 films they love (e.g. "Social Network + Uncut Gems"); we
retrieve the neighborhood in AFFECT space (not genre space) and let the LLM
name the through-line in one sentence.

Works on day one with ZERO interaction data — reads only the offline
identity_embedding + identity_json["affect_vector"] produced by
movie_identity.py. That's why it doubles as cold-start and as our
differentiator.

Pure NumPy cosine on the request path. One optional LLM call per request
for the through-line, cached by sorted(tmdb_ids) so iterating in the UI
is free.

At >~1M rows, swap the catalog scan for a pgvector
`ORDER BY embedding <=> :centroid` query — same math, indexed.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.ml.llm import openai_client as llm
from app.shared.models.actions import WatchHistory
from app.shared.models.movie import Movie
from app.shared.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["anchors"])

# Blend of semantic essence vs. structured affect axes. Semantic carries
# nuance; axes keep it honest and interpretable. Tune these two, not ten.
W_SEMANTIC = 0.7
W_AFFECT = 0.3
AFFECT_DIM = 9

# In-process LRU for the through-line LLM call, keyed by sorted tmdb_ids.
# Small footprint; cleared on process restart. Redis is the next step.
_THROUGH_LINE_CACHE: dict[tuple[int, ...], str] = {}
_THROUGH_LINE_CACHE_MAX = 256


class AnchorRequest(BaseModel):
    tmdb_ids: list[int] = Field(..., min_length=2, max_length=4)
    limit: int = Field(20, ge=1, le=50)
    explain: bool = True


def _l2(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n > 0 else v


def _affect_vec(movie: Movie) -> np.ndarray | None:
    aj = movie.identity_json or {}
    av = aj.get("affect_vector")
    if not isinstance(av, list) or len(av) != AFFECT_DIM:
        return None
    try:
        return np.asarray(av, dtype=np.float32)
    except (TypeError, ValueError):
        return None


def _vibe(movie: Movie) -> str | None:
    aj = movie.identity_json or {}
    v = aj.get("vibe")
    return v if isinstance(v, str) and v else None


def _affect_axes_dict(movie: Movie) -> dict[str, float] | None:
    aj = movie.identity_json or {}
    ax = aj.get("affect_axes")
    return ax if isinstance(ax, dict) else None


@router.post("/from-anchors")
async def from_anchors(
    body: AnchorRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # 1. Resolve anchor films from tmdb_ids.
    result = await db.execute(
        select(Movie).where(Movie.tmdb_id.in_(body.tmdb_ids))
    )
    anchors: list[Movie] = list(result.scalars().all())

    if len(anchors) < 2:
        found = {m.tmdb_id for m in anchors}
        missing = [tid for tid in body.tmdb_ids if tid not in found]
        if missing:
            logger.warning("from-anchors: unresolved tmdb_ids %s", missing)
        raise HTTPException(
            400,
            f"Need at least 2 known films. Missing tmdb_ids: {missing or 'n/a'}.",
        )

    # 2. Build the affect + semantic centroids from anchors that are enriched.
    sem_anchors: list[np.ndarray] = []
    aff_anchors: list[np.ndarray] = []
    unenriched_titles: list[str] = []
    for m in anchors:
        sem = llm.deserialize_embedding(m.identity_embedding)
        if sem is None:
            unenriched_titles.append(m.title)
            continue
        sem_anchors.append(_l2(sem.astype(np.float32)))
        aff = _affect_vec(m)
        if aff is not None:
            aff_anchors.append(aff)

    if len(sem_anchors) < 2:
        raise HTTPException(
            409,
            "These films aren't enriched yet. Run "
            "`python -m scripts.extract_movie_identities --limit N` first. "
            f"Unenriched: {unenriched_titles or 'all of them'}.",
        )

    sem_centroid = _l2(np.mean(np.stack(sem_anchors), axis=0))
    aff_centroid = (
        np.mean(np.stack(aff_anchors), axis=0) if aff_anchors else None
    )
    aff_centroid_unit = _l2(aff_centroid) if aff_centroid is not None else None

    # 3. Score the catalog against the centroids. NumPy loop is fine at this
    # scale (~10k movies); swap for pgvector when the catalog grows.
    anchor_ids = {m.id for m in anchors}
    watched_rows = await db.execute(
        select(WatchHistory.movie_id).where(WatchHistory.user_id == user.id)
    )
    exclude = anchor_ids | set(watched_rows.scalars().all())

    catalog_rows = await db.execute(
        select(Movie).where(Movie.identity_embedding.is_not(None))
    )
    scored: list[tuple[float, Movie]] = []
    for m in catalog_rows.scalars():
        if m.id in exclude:
            continue
        sem = llm.deserialize_embedding(m.identity_embedding)
        if sem is None:
            continue
        sem_sim = float(np.dot(_l2(sem.astype(np.float32)), sem_centroid))
        score = W_SEMANTIC * sem_sim
        if aff_centroid_unit is not None:
            aff = _affect_vec(m)
            if aff is not None:
                aff_sim = float(np.dot(_l2(aff), aff_centroid_unit))
                score += W_AFFECT * aff_sim
        scored.append((score, m))

    scored.sort(key=lambda t: t[0], reverse=True)
    top = scored[: body.limit]

    # 4. Through-line: one LLM call, cached by sorted(tmdb_ids).
    through_line: str | None = None
    if body.explain and top and llm.is_available():
        through_line = await _through_line(anchors, [m for _, m in top[:5]], body.tmdb_ids)

    return {
        "anchors": [
            {"tmdb_id": m.tmdb_id, "title": m.title, "vibe": _vibe(m)}
            for m in anchors
        ],
        "through_line": through_line,
        "results": [
            {
                "tmdb_id": m.tmdb_id,
                "title": m.title,
                "poster_path": m.poster_path,
                "match_score": round(score * 100),
                "vibe": _vibe(m),
                "affect_axes": _affect_axes_dict(m),
            }
            for score, m in top
        ],
        "pipeline": "affect-anchor-v1",
    }


async def _through_line(
    anchors: list[Movie],
    picks: list[Movie],
    requested_ids: list[int],
) -> str | None:
    """Name the shared viewing-experience between the anchors in one sentence,
    then justify the top picks against it. Cached by sorted(tmdb_ids)."""
    key = tuple(sorted(requested_ids))
    cached = _THROUGH_LINE_CACHE.get(key)
    if cached is not None:
        return cached

    def _feel(m: Movie) -> str:
        aj = m.identity_json or {}
        para = aj.get("experiential_paragraph") or aj.get("vibe") or ""
        return f"{m.title}: {para}"

    prompt = (
        "These are films a user loves:\n  "
        + "\n  ".join(_feel(m) for m in anchors)
        + "\n\nFirst, in ONE sentence, name the shared VIEWING EXPERIENCE "
        "that connects them (the feeling, not the genre). Then in one line "
        "say why these picks fit:\n  "
        + "\n  ".join(_feel(m) for m in picks)
        + "\n\nWrite for the user, second person, no preamble."
    )

    try:
        text = await llm.generate_text(prompt)
    except Exception as exc:  # noqa: BLE001
        logger.warning("through-line generation failed: %s", exc)
        return None

    if text:
        if len(_THROUGH_LINE_CACHE) >= _THROUGH_LINE_CACHE_MAX:
            # FIFO eviction — pop oldest insertion.
            _THROUGH_LINE_CACHE.pop(next(iter(_THROUGH_LINE_CACHE)))
        _THROUGH_LINE_CACHE[key] = text
    return text
