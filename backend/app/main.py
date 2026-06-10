from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import engine, Base

# Import all models so they register with Base.metadata
from .models import (  # noqa: F401
    user,
    movie,
    actions,
    social,
    onboarding,
    taste_engine,
    slates,
    discourse,
    notifications,
    artists,
    releases,
    cultural,
    festivals,
    theatres,
    watch_parties,
    circles,
    chapters,
    posts,
    match_cut,
    dms,
    chat,
    similar_cache,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev only — use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()
    from .core.redis_client import close_redis
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

from .routes import all_routers

for router in all_routers:
    app.include_router(router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "phase": 2, "stack": "python-fastapi"}
