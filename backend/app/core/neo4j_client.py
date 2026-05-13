"""Neo4j async driver wrapper."""

from neo4j import AsyncGraphDatabase

from .config import settings

_driver = None


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


async def run_query(query: str, params: dict | None = None) -> list[dict]:
    """Run a Cypher query and return results as list of dicts."""
    driver = get_neo4j_driver()
    async with driver.session() as session:
        result = await session.run(query, params or {})
        return [record.data() async for record in result]


async def run_write(query: str, params: dict | None = None):
    """Run a write Cypher query."""
    driver = get_neo4j_driver()
    async with driver.session() as session:
        await session.run(query, params or {})