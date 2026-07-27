from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base

# Import all models so they register with Base.metadata
from app import models_registry  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev only — use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()
    from app.core.redis_client import close_redis
    await close_redis()


app = FastAPI(title="SlateClub API", version="2.0", lifespan=lifespan)

# CORS
allowed_origins = [o.strip() for o in settings.FRONTEND_URL.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register routers ───────────────────────────────────────

from app.routes import all_routers

for router in all_routers:
    app.include_router(router)


@app.get("/api/health")
async def health():
    from app.core.neo4j_client import neo4j_available

    neo4j_up = await neo4j_available()
    return {
        "status": "ok",
        "phase": 2,
        "stack": "python-fastapi",
        "services": {
            # Neo4j is optional — taste-graph features degrade gracefully when down.
            "neo4j": "up" if neo4j_up else "down",
        },
    }
