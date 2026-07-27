"""Neo4j async driver wrapper.

Neo4j is an optional dependency (see CLAUDE.md). When it is unreachable the
taste-graph queries degrade to "no data" — callers already treat an empty
result as "not enough data yet" — instead of surfacing a 500.
"""

import logging

from neo4j import AsyncGraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from app.core.config import settings

logger = logging.getLogger(__name__)

_driver = None
_unavailable_logged = False


def get_neo4j_driver():
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
    return _driver


async def close_neo4j():
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


def _note_unavailable(exc: Exception) -> None:
    """Log the first time Neo4j is found unreachable, then stay quiet."""
    global _unavailable_logged
    if not _unavailable_logged:
        logger.warning(
            "Neo4j unavailable (%s) — taste-graph features degrade to empty. "
            "Start Neo4j at %s to enable them.",
            exc.__class__.__name__,
            settings.NEO4J_URI,
        )
        _unavailable_logged = True


async def run_query(query: str, params: dict | None = None) -> list[dict]:
    """Run a Cypher query and return results as list of dicts.

    Returns an empty list if Neo4j is unavailable.
    """
    try:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run(query, params or {})
            return [record.data() async for record in result]
    except (ServiceUnavailable, OSError, Neo4jError) as exc:
        _note_unavailable(exc)
        return []


async def run_write(query: str, params: dict | None = None):
    """Run a write Cypher query. No-ops if Neo4j is unavailable."""
    try:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run(query, params or {})
    except (ServiceUnavailable, OSError, Neo4jError) as exc:
        _note_unavailable(exc)


async def neo4j_available() -> bool:
    """Return True if Neo4j answers a trivial query, False otherwise."""
    try:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run("RETURN 1")
        return True
    except (ServiceUnavailable, OSError, Neo4jError):
        return False