# core — framework & infrastructure

The low-level plumbing every part of the app sits on: auth, config, the database session,
and optional Redis/Neo4j clients. No product logic here.

## Files
- **`config.py`** — `settings` loaded from `.env` (DATABASE_URL on port 5433, TMDB key, JWT
  secrets, FRONTEND_URL for CORS, optional NEO4J_*/API keys).
- **`database.py`** — the async SQLAlchemy 2.0 setup: `engine`, `Base` (all models inherit
  it), and the `get_db` dependency that yields an `AsyncSession` per request.
- **`auth.py`** — password hashing, JWT create/verify, and the `get_current_user`
  dependency that every protected route uses to resolve the logged-in `User`.
- **`redis_client.py`** — the Redis connection used by `taste_cache` (degrades gracefully
  if Redis is down).
- **`neo4j_client.py`** — the optional Neo4j driver for the taste graph; `neo4j_available()`
  lets features fall back cleanly when it's not running.

## How it works
Routes declare `Depends(get_db)` and `Depends(get_current_user)`; startup in `main.py`
runs `Base.metadata.create_all`. Redis and Neo4j are optional — the app runs without them,
just with those features degraded.
