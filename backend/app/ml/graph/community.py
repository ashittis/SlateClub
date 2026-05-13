"""
Louvain Community Detection — Cinematic Tribes (ARCHITECTURE.md Section 1.4)

Runs on the User-User TASTE_SIMILAR graph to detect taste clusters.
Each cluster becomes a "Cinematic Tribe" with a generated name.
"""

import community as community_louvain  # python-louvain
import networkx as nx

from ...core.neo4j_client import run_query, run_write
from . import taste_graph


# Tribe name templates based on dominant genres in the cluster
GENRE_TRIBE_NAMES = {
    28: "Action Junkies",
    12: "Adventure Seekers",
    16: "Animation Lovers",
    35: "Comedy Club",
    80: "Crime & Noir Devotees",
    99: "Documentary Minds",
    18: "Drama Connoisseurs",
    10751: "Family Film Circle",
    14: "Fantasy Realm",
    36: "History Buffs",
    27: "Midnight Horror Heads",
    10402: "Musical Souls",
    9648: "Mystery Enthusiasts",
    10749: "Romance Hearts",
    878: "Sci-Fi Collective",
    53: "Thriller Seekers",
    10752: "War Cinema Circle",
    37: "Western Riders",
}

LANGUAGE_TRIBE_NAMES = {
    "hi": "Bollywood Brigade",
    "ta": "Tamil New Wave",
    "te": "Telugu Blockbuster Club",
    "ml": "Malayalam Cinema Society",
    "ko": "Korean Cinema Devotees",
    "ja": "Japanese Film Society",
    "fr": "French New Wave Circle",
    "es": "Spanish Cinema Collective",
}


async def build_similarity_graph() -> nx.Graph:
    """Pull TASTE_SIMILAR edges from Neo4j and build a NetworkX graph."""
    edges = await run_query(
        """
        MATCH (a:User)-[r:TASTE_SIMILAR]->(b:User)
        RETURN a.id AS source, b.id AS target, r.weight AS weight
        """
    )

    G = nx.Graph()
    for edge in edges:
        G.add_edge(edge["source"], edge["target"], weight=edge["weight"])

    return G


async def detect_communities() -> dict[str, list[str]]:
    """
    Run Louvain community detection on the taste similarity graph.
    Returns {cluster_id: [user_ids]}.
    """
    G = await build_similarity_graph()

    if G.number_of_nodes() < 3:
        return {}

    # Run Louvain
    partition = community_louvain.best_partition(G, weight="weight", resolution=1.0)

    # Group users by cluster
    clusters: dict[int, list[str]] = {}
    for user_id, cluster_id in partition.items():
        clusters.setdefault(cluster_id, []).append(user_id)

    # Filter out tiny clusters (< 2 members)
    clusters = {k: v for k, v in clusters.items() if len(v) >= 2}

    return {f"tribe_{k}": v for k, v in clusters.items()}


async def name_cluster(cluster_id: str, user_ids: list[str]) -> str:
    """Generate a name for a cluster based on its members' dominant genres and languages."""
    if not user_ids:
        return "Film Enthusiasts"

    # Get top-rated genres from cluster members
    genre_data = await run_query(
        """
        MATCH (u:User)-[r:RATED]->(m:Movie)
        WHERE u.id IN $uids AND r.value >= 4
        RETURN m.genres AS genres
        """,
        {"uids": user_ids[:50]},
    )

    genre_counts: dict[int, int] = {}
    for row in genre_data:
        genres = row.get("genres") or []
        if isinstance(genres, list):
            for g in genres:
                gid = g if isinstance(g, int) else (g.get("id") if isinstance(g, dict) else None)
                if gid:
                    genre_counts[gid] = genre_counts.get(gid, 0) + 1

    if genre_counts:
        top_genre = max(genre_counts, key=genre_counts.get)  # type: ignore
        if top_genre in GENRE_TRIBE_NAMES:
            return GENRE_TRIBE_NAMES[top_genre]

    return f"Cinematic Tribe #{cluster_id.split('_')[-1]}"


async def run_community_detection():
    """Full community detection pipeline: detect → name → persist to Neo4j."""
    clusters = await detect_communities()

    for cluster_id, user_ids in clusters.items():
        cluster_name = await name_cluster(cluster_id, user_ids)

        for user_id in user_ids:
            # Soft membership weight based on how connected user is within cluster
            weight = min(len(user_ids) / 100.0, 1.0)  # simple heuristic
            await taste_graph.set_cluster_membership(user_id, cluster_id, cluster_name, weight)

    return {cid: {"name": await name_cluster(cid, uids), "size": len(uids)} for cid, uids in clusters.items()}


async def get_user_tribe(user_id: str) -> dict | None:
    """Get a user's primary Cinematic Tribe."""
    clusters = await taste_graph.get_user_clusters(user_id)
    if not clusters:
        return None

    primary = clusters[0]
    # Get cluster size
    size_data = await run_query(
        """
        MATCH (u:User)-[:MEMBER_OF]->(c:Cluster {id: $cid})
        RETURN count(u) AS size
        """,
        {"cid": primary["cluster_id"]},
    )
    size = size_data[0]["size"] if size_data else 0

    return {
        "cluster_id": primary["cluster_id"],
        "name": primary["cluster_name"],
        "weight": primary["weight"],
        "size": size,
        "all_tribes": clusters,
    }
