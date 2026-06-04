"""
backend/app/routes/anchors.py  (register in app/routes/__init__.py -> all_routers)

The "connective tissue" feature — your demo-able moat.

User names 2-4 films they love ("Social Network + Uncut Gems"); we retrieve the
neighborhood in AFFECT space (not genre space) and let the LLM name the through-line.

This works on day one with ZERO interaction data — it reads only the offline
identity_embeddings produced by movie_identity.py. That's why it doubles as your
cold-start engine and your differentiator at the same time.

Pure vector math on the request path; the only LLM call is the (optional, cached)
explanation, and it's one call per request regardless of catalog size.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session                 # adjust import to your session dep
from app.auth import get_current_user          # adjust import to your auth dep
from app.models.movie import Movie
from app.models.social import WatchHistory     # adjust if your path differs
from app.ml.llm.gemini_client import GeminiClient, get_gemini  # adjust factory import

router = APIRouter(prefix="/api/recommendations", tags=["anchors"])

# Blend of semantic essence vs. structured affect axes. Semantic carries nuance;
# axes keep it honest and interpretable. Tune these two, not ten.
W_SEMANTIC = 0.7
W_AFFECT = 0.3
AFFECT_DIM = 9


class AnchorRequest(BaseModel):
    tmdb_ids: list[int] = Field(..., min_length=2, max_length=4)
    limit: int = Field(20, ge=1, le=50)
    explain: bool = True


def _unpack(b: bytes | None) -> np.ndarray | None:
    if not b:
        return None
    return np.frombuffer(b, dtype=np.float32)


def _l2(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v)
    return v / n if n > 0 else v


def _affect_vec(movie: Movie) -> np.ndarray | None:
    aj = movie.identity_json or {}
    av = aj.get("affect_vector")
    if not av or len(av) != AFFECT_DIM:
        return None
    return np.asarray(av, dtype=np.float32)


@router.post("/from-anchors")
async def from_anchors(
    body: AnchorRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    gemini: GeminiClient = Depends(get_gemini),
):
    # 1) Resolve anchor films and require they've been enriched.
    anchors = (await session.execute(
        select(Movie).where(Movie.tmdb_id.in_(body.tmdb_ids))
    )).scalars().all()
    if len(anchors) < 2:
        raise HTTPException(400, "Need at least 2 known films to find the through-line.")

    sem_anchors, aff_anchors = [], []
    for m in anchors:
        s = _unpack(m.identity_embedding)
        a = _affect_vec(m)
        if s is not None:
            sem_anchors.append(_l2(s))
        if a is not None:
            aff_anchors.append(a)
    if not sem_anchors:
        raise HTTPException(409, "These films aren't enriched yet. Run identity extraction first.")

    # 2) Centroid in affect space = the shared essence of what the user loves.
    sem_centroid = _l2(np.mean(sem_anchors, axis=0))
    aff_centroid = np.mean(aff_anchors, axis=0) if aff_anchors else None

    # 3) Score the catalog against the centroid. (At >~1M rows, swap this for a
    #    pgvector ORDER BY embedding <=> :centroid query — same math, indexed.)
    anchor_ids = {m.id for m in anchors}
    watched = (await session.execute(
        select(WatchHistory.movie_id).where(WatchHistory.user_id == user.id)
    )).scalars().all()
    exclude = anchor_ids | set(watched)

    catalog = (await session.execute(
        select(Movie).where(Movie.identity_embedding.is_not(None))
    )).scalars().all()

    scored: list[tuple[float, Movie]] = []
    for m in catalog:
        if m.id in exclude:
            continue
        s = _unpack(m.identity_embedding)
        if s is None:
            continue
        sem_sim = float(np.dot(_l2(s), sem_centroid))  # cosine, both unit-norm
        score = W_SEMANTIC * sem_sim
        if aff_centroid is not None:
            a = _affect_vec(m)
            if a is not None:
                # cosine in the small, signed affect space
                aff_sim = float(np.dot(_l2(a), _l2(aff_centroid)))
                score += W_AFFECT * aff_sim
        scored.append((score, m))

    scored.sort(key=lambda t: t[0], reverse=True)
    top = scored[: body.limit]

    # 4) One LLM call names the connective tissue. Cache by sorted(tmdb_ids).
    through_line = None
    if body.explain and top:
        through_line = await _explain(gemini, anchors, [m for _, m in top[:5]])

    return {
        "anchors": [{"tmdb_id": m.tmdb_id, "title": m.title} for m in anchors],
        "through_line": through_line,
        "results": [
            {
                "tmdb_id": m.tmdb_id,
                "title": m.title,
                "poster_path": m.poster_path,
                "match_score": round(score * 100),
                "vibe": (m.identity_json or {}).get("vibe"),
            }
            for score, m in top
        ],
        "pipeline": "affect-anchor-v1",
    }


async def _explain(gemini: GeminiClient, anchors: list[Movie], picks: list[Movie]) -> str | None:
    """Name the shared viewing-experience between the anchors, in one sentence,
    then justify the top picks against it. Reads only identity_json (cheap)."""
    def feel(m: Movie) -> str:
        aj = m.identity_json or {}
        return f"{m.title}: {aj.get('experiential_paragraph', aj.get('vibe', ''))}"

    prompt = (
        "These are films a user loves:\n  " + "\n  ".join(feel(m) for m in anchors) +
        "\n\nFirst, in ONE sentence, name the shared VIEWING EXPERIENCE that connects "
        "them (the feeling, not the genre). Then say in one line why these picks fit:\n  "
        + "\n  ".join(feel(m) for m in picks) +
        "\n\nWrite for the user, second person, no preamble."
    )
    try:
        return await gemini.generate_text(prompt)
    except Exception:
        return None
