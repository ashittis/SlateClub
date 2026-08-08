"""Community Intelligence Engine — POST /api/discovery/consensus.

Given a seed film, returns the film community's consensus on "what to watch after
this" (grounded in real web mention frequency), re-ranked through the requesting
user's Cinema DNA, each film with a human "why".

Reads only the cached community pool (community_engine). On a cold cache it warms
off-response and serves the essence engine's answer meanwhile, so the endpoint is
always fast and never hard-fails. Authed — personalization needs the user.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.features.discovery import community_engine
from app.features.discovery.community_personalize import personalize, user_taste_vector
from app.features.discovery.community_warm import schedule_warm
from app.features.recommendation.similar_films import answer_slice, find_similar_films
from app.shared.models.movie import Movie
from app.shared.models.user import User

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


class ConsensusRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tmdb_id: Annotated[int, Field(alias="tmdbId")]
    media_type: Annotated[str, Field(default="movie", alias="mediaType")]
    offset: Annotated[int, Field(default=0, ge=0, le=20)]
    personalized: Annotated[bool, Field(default=True)]


async def _essence_fallback(db: AsyncSession, body: "ConsensusRequest") -> dict:
    """Serve the essence engine's answer while the community pool warms."""
    payload = await find_similar_films(db, body.tmdb_id, media_type=body.media_type)
    sliced = answer_slice(payload, offset=body.offset)
    return {
        "seed": payload.get("seed"),
        "essence": payload.get("essence"),
        "source": "essence-fallback",
        "answer": sliced["answer"],
        "forYou": None,
        "personalized": False,
        "poolSize": sliced["poolSize"],
        "offset": sliced["offset"],
        "hasMore": sliced["hasMore"],
        "warming": True,
    }


@router.post("/consensus")
async def consensus(
    body: ConsensusRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payload = await community_engine.get_cached_consensus(db, body.tmdb_id)
    if payload is None or not payload.get("candidates"):
        schedule_warm(body.tmdb_id, body.media_type)
        return await _essence_fallback(db, body)

    candidates: list[dict] = payload["candidates"]

    # Movie rows for the personalization embeddings.
    tmdb_ids = [c["tmdbId"] for c in candidates]
    movies = (
        await db.execute(select(Movie).where(Movie.tmdb_id.in_(tmdb_ids)))
    ).scalars().all()
    movies_by_tmdb = {m.tmdb_id: m for m in movies}

    taste_vec = await user_taste_vector(db, user) if body.personalized else None
    use_personal = body.personalized and taste_vec is not None
    result = personalize(candidates, taste_vec, movies_by_tmdb)

    ordered = result["personalized"] if use_personal else candidates
    sliced = community_engine.consensus_slice(ordered, offset=body.offset)

    return {
        "seed": payload.get("seed"),
        "essence": payload.get("essence"),
        "source": "community",
        "answer": sliced["answer"],
        "communityTop": candidates[0] if candidates else None,
        "forYou": result["forYou"] if use_personal else None,
        "personalized": use_personal,
        "poolSize": sliced["poolSize"],
        "offset": sliced["offset"],
        "hasMore": sliced["hasMore"],
        "warming": False,
    }
