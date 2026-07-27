"""
Graph-Powered Recommendations (ARCHITECTURE.md Section 1.4)

Produces candidates from:
- Cluster consensus (films loved by ≥30% of your tribe)
- Second-degree bridge (films popular in adjacent clusters)
- Friend boost (films rated ≥4 by ≥2 taste-similar users)
- Director affinity (new films by directors you love)
"""

from app.ml.graph import taste_graph


async def get_graph_candidates(user_id: str, limit: int = 100) -> list[dict]:
    """
    Aggregate graph-powered candidates from multiple signals.
    Returns list of {movie_id, tmdb_id, title, source, score}.
    """
    candidates: dict[str, dict] = {}

    # 1. Cluster consensus
    clusters = await taste_graph.get_user_clusters(user_id)
    if clusters:
        primary_cluster = clusters[0]["cluster_id"]
        cluster_movies = await taste_graph.get_cluster_popular_movies(primary_cluster, limit=30)
        for m in cluster_movies:
            mid = m["movie_id"]
            if mid not in candidates:
                candidates[mid] = {
                    "movie_id": mid,
                    "tmdb_id": m.get("tmdb_id"),
                    "title": m.get("title"),
                    "source": "cluster_consensus",
                    "score": m.get("cluster_pct", 0.5),
                    "explanation": f"Loved by your {clusters[0]['cluster_name']}",
                }

    # 2. Friend boost
    friend_movies = await taste_graph.get_friend_boost_movies(user_id, limit=20)
    for m in friend_movies:
        mid = m["movie_id"]
        if mid not in candidates:
            candidates[mid] = {
                "movie_id": mid,
                "tmdb_id": m.get("tmdb_id"),
                "title": m.get("title"),
                "source": "friend_boost",
                "score": min(m.get("friend_count", 2) / 5.0, 1.0),
                "explanation": f"{m.get('friend_count', 2)} taste twins watched this",
            }

    # 3. Director affinity
    director_movies = await taste_graph.get_director_affinity_movies(user_id, limit=15)
    for m in director_movies:
        mid = m["movie_id"]
        if mid not in candidates:
            candidates[mid] = {
                "movie_id": mid,
                "tmdb_id": m.get("tmdb_id"),
                "title": m.get("title"),
                "source": "director_affinity",
                "score": m.get("affinity", 0.7),
                "explanation": f"From {m.get('director', 'a director')} you love",
            }

    # Sort by score and return
    result = sorted(candidates.values(), key=lambda x: -x["score"])
    return result[:limit]
