"""
Tribe API — Phase 4
Cinematic Tribes: community-detected taste clusters.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.models.user import User
from app.ml.graph.community import get_user_tribe, run_community_detection
from app.ml.graph.taste_graph import get_user_clusters, get_cluster_popular_movies, get_taste_neighbors
from app.ml.graph.graph_recommend import get_graph_candidates

router = APIRouter(prefix="/api/tribes", tags=["tribes"])


@router.get("/my-tribe")
async def my_tribe(user: User = Depends(get_current_user)):
    """Get the current user's Cinematic Tribe."""
    tribe = await get_user_tribe(user.id)
    if not tribe:
        return {"tribe": None, "message": "Not enough data to assign a tribe yet"}
    return {"tribe": tribe}


@router.get("/clusters")
async def my_clusters(user: User = Depends(get_current_user)):
    """Get all clusters the user belongs to (soft membership)."""
    clusters = await get_user_clusters(user.id)
    return {"clusters": clusters}


@router.get("/{cluster_id}/movies")
async def cluster_movies(cluster_id: str, limit: int = 30):
    """Get popular movies in a specific cluster/tribe."""
    movies = await get_cluster_popular_movies(cluster_id, limit=limit)
    return {"movies": movies}


@router.get("/taste-neighbors")
async def taste_neighbors(user: User = Depends(get_current_user)):
    """Get users with similar taste (taste twins)."""
    neighbors = await get_taste_neighbors(user.id, limit=10)
    return {"neighbors": neighbors}


@router.get("/graph-recommendations")
async def graph_recommendations(
    limit: int = 30,
    user: User = Depends(get_current_user),
):
    """Get graph-powered recommendations (cluster consensus + friend boost + director affinity)."""
    candidates = await get_graph_candidates(user.id, limit=limit)
    return {"recommendations": candidates}


@router.post("/detect")
async def trigger_detection(user: User = Depends(get_current_user)):
    """Manually trigger community detection (admin/dev endpoint)."""
    result = await run_community_detection()
    return {"clusters": result, "message": f"Detected {len(result)} communities"}
