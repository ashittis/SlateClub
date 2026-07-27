"""
Taste Engine — essence-reasoned "movies like X".

One endpoint: POST /api/taste-engine/similar. Given a seed film it returns a
small, essence-matched answer (see services/similar_films.py). Public.

(The old sentence-builder surface — /options, /match-count, /query, /presets —
was removed: nothing consumed it, and /query was a popularity sort behind a slot
filter whose mood/platform "filters" only scaled a global multiplier.)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.recommendation.similar_films import answer_slice, find_similar_films

router = APIRouter(prefix="/api/taste-engine", tags=["taste-engine"])


class SimilarRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tmdb_id: Annotated[int, Field(alias="tmdbId")]
    media_type: Annotated[str, Field(default="movie", alias="mediaType")]
    # A 5-film window into the cached ~30-film pool. offset steps by 5 for the
    # "None of these fit" path; languages filters the pool server-side.
    offset: Annotated[int, Field(default=0, ge=0, le=25)]
    languages: Annotated[list[str], Field(default_factory=list)]


@router.post("/similar")
async def similar(
    body: SimilarRequest,
    db: AsyncSession = Depends(get_db),
):
    """Essence-reasoned 'movies like X' — returns a tight 4–5 film answer, each
    with a one-line reason, sliced from a cached language-diverse pool."""
    payload = await find_similar_films(db, body.tmdb_id, media_type=body.media_type)
    return answer_slice(payload, offset=body.offset, languages=body.languages)
