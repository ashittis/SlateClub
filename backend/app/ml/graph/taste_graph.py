"""
Taste Graph Engine (ARCHITECTURE.md Section 1.4)

Manages the Neo4j knowledge graph connecting users, films, directors, themes, and moods.
Edge weights derived from real behavioral signals.
"""

from app.core.neo4j_client import run_query, run_write


# ─── Graph Schema Setup ─────────────────────────────────────

async def setup_constraints():
    """Create Neo4j indexes and constraints."""
    queries = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (m:Movie) REQUIRE m.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (d:Director) REQUIRE d.tmdb_id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (t:Theme) REQUIRE t.label IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Cluster) REQUIRE c.id IS UNIQUE",
        "CREATE INDEX IF NOT EXISTS FOR (m:Movie) ON (m.tmdb_id)",
    ]
    for q in queries:
        await run_write(q)


# ─── Node Operations ────────────────────────────────────────

async def upsert_user_node(user_id: str, name: str, username: str):
    await run_write(
        "MERGE (u:User {id: $id}) SET u.name = $name, u.username = $username",
        {"id": user_id, "name": name, "username": username},
    )


async def upsert_movie_node(movie_id: str, tmdb_id: int, title: str, genres: list[str] | None = None):
    await run_write(
        "MERGE (m:Movie {id: $id}) SET m.tmdb_id = $tmdb_id, m.title = $title, m.genres = $genres",
        {"id": movie_id, "tmdb_id": tmdb_id, "title": title, "genres": genres or []},
    )


async def upsert_director_node(tmdb_id: int, name: str):
    await run_write(
        "MERGE (d:Director {tmdb_id: $tmdb_id}) SET d.name = $name",
        {"tmdb_id": tmdb_id, "name": name},
    )


# ─── Edge Operations ────────────────────────────────────────

async def set_user_watched(user_id: str, movie_id: str, weight: float = 0.6):
    await run_write(
        """
        MATCH (u:User {id: $uid}), (m:Movie {id: $mid})
        MERGE (u)-[r:WATCHED]->(m)
        SET r.weight = $weight
        """,
        {"uid": user_id, "mid": movie_id, "weight": weight},
    )


async def set_user_rated(user_id: str, movie_id: str, rating: float):
    normalized = rating / 5.0
    await run_write(
        """
        MATCH (u:User {id: $uid}), (m:Movie {id: $mid})
        MERGE (u)-[r:RATED]->(m)
        SET r.weight = $weight, r.value = $rating
        """,
        {"uid": user_id, "mid": movie_id, "weight": normalized, "rating": rating},
    )


async def set_user_reviewed(user_id: str, movie_id: str, sentiment: float = 0.5):
    await run_write(
        """
        MATCH (u:User {id: $uid}), (m:Movie {id: $mid})
        MERGE (u)-[r:REVIEWED]->(m)
        SET r.weight = $weight
        """,
        {"uid": user_id, "mid": movie_id, "weight": 1.0 + sentiment},
    )


async def set_taste_similar(user_a_id: str, user_b_id: str, similarity: float):
    """Set TASTE_SIMILAR edge between two users (threshold ≥ 0.7)."""
    if similarity < 0.7:
        return
    await run_write(
        """
        MATCH (a:User {id: $aid}), (b:User {id: $bid})
        MERGE (a)-[r:TASTE_SIMILAR]->(b)
        SET r.weight = $weight
        """,
        {"aid": user_a_id, "bid": user_b_id, "weight": similarity},
    )


async def set_user_director_affinity(user_id: str, director_tmdb_id: int, avg_rating: float):
    await run_write(
        """
        MATCH (u:User {id: $uid}), (d:Director {tmdb_id: $did})
        MERGE (u)-[r:AFFINITY]->(d)
        SET r.weight = $weight
        """,
        {"uid": user_id, "did": director_tmdb_id, "weight": avg_rating / 5.0},
    )


async def set_movie_similar_tone(movie_a_id: str, movie_b_id: str, similarity: float):
    await run_write(
        """
        MATCH (a:Movie {id: $aid}), (b:Movie {id: $bid})
        MERGE (a)-[r:SIMILAR_TONE]->(b)
        SET r.weight = $weight
        """,
        {"aid": movie_a_id, "bid": movie_b_id, "weight": similarity},
    )


async def set_cluster_membership(user_id: str, cluster_id: str, cluster_name: str, weight: float):
    await run_write(
        """
        MERGE (c:Cluster {id: $cid})
        SET c.name = $cname
        WITH c
        MATCH (u:User {id: $uid})
        MERGE (u)-[r:MEMBER_OF]->(c)
        SET r.weight = $weight
        """,
        {"uid": user_id, "cid": cluster_id, "cname": cluster_name, "weight": weight},
    )


# ─── Graph Queries ───────────────────────────────────────────

async def get_user_clusters(user_id: str) -> list[dict]:
    """Get clusters a user belongs to, ordered by membership weight."""
    return await run_query(
        """
        MATCH (u:User {id: $uid})-[r:MEMBER_OF]->(c:Cluster)
        RETURN c.id AS cluster_id, c.name AS cluster_name, r.weight AS weight
        ORDER BY r.weight DESC
        """,
        {"uid": user_id},
    )


async def get_cluster_popular_movies(cluster_id: str, limit: int = 30) -> list[dict]:
    """Get movies highly rated by ≥ 30% of a cluster's members."""
    return await run_query(
        """
        MATCH (u:User)-[m:MEMBER_OF]->(c:Cluster {id: $cid})
        WITH collect(u) AS members, count(u) AS total
        UNWIND members AS member
        MATCH (member)-[r:RATED]->(movie:Movie)
        WHERE r.value >= 4
        WITH movie, count(*) AS raters, total
        WHERE raters >= total * 0.3
        RETURN movie.id AS movie_id, movie.title AS title, movie.tmdb_id AS tmdb_id,
               raters, toFloat(raters) / total AS cluster_pct
        ORDER BY cluster_pct DESC
        LIMIT $limit
        """,
        {"cid": cluster_id, "limit": limit},
    )


async def get_friend_boost_movies(user_id: str, limit: int = 20) -> list[dict]:
    """Movies rated ≥ 4 by ≥ 2 followed friends in last 14 days."""
    return await run_query(
        """
        MATCH (u:User {id: $uid})-[:TASTE_SIMILAR]->(friend:User)-[r:RATED]->(m:Movie)
        WHERE r.value >= 4 AND r.weight > 0.7
        WITH m, count(DISTINCT friend) AS friend_count
        WHERE friend_count >= 2
        RETURN m.id AS movie_id, m.title AS title, m.tmdb_id AS tmdb_id, friend_count
        ORDER BY friend_count DESC
        LIMIT $limit
        """,
        {"uid": user_id, "limit": limit},
    )


async def get_director_affinity_movies(user_id: str, limit: int = 15) -> list[dict]:
    """New films by directors the user has high affinity for."""
    return await run_query(
        """
        MATCH (u:User {id: $uid})-[a:AFFINITY]->(d:Director)
        WHERE a.weight >= 0.7
        MATCH (m:Movie)-[:DIRECTED_BY]->(d)
        WHERE NOT (u)-[:WATCHED]->(m) AND NOT (u)-[:RATED]->(m)
        RETURN m.id AS movie_id, m.title AS title, m.tmdb_id AS tmdb_id,
               d.name AS director, a.weight AS affinity
        ORDER BY a.weight DESC
        LIMIT $limit
        """,
        {"uid": user_id, "limit": limit},
    )


async def get_taste_neighbors(user_id: str, limit: int = 10) -> list[dict]:
    """Get taste-similar users (for social features)."""
    return await run_query(
        """
        MATCH (u:User {id: $uid})-[r:TASTE_SIMILAR]->(neighbor:User)
        RETURN neighbor.id AS user_id, neighbor.name AS name,
               neighbor.username AS username, r.weight AS similarity
        ORDER BY r.weight DESC
        LIMIT $limit
        """,
        {"uid": user_id, "limit": limit},
    )