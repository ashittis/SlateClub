from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema comes from Alembic (`alembic upgrade head`), never from create_all
    # on startup — that used to run here and silently masked a broken migration
    # chain for months. If a table is missing, the migration is missing.
    yield
    await engine.dispose()
    from app.core.redis_client import close_redis
    await close_redis()


app = FastAPI(
    title="Kaset API",
    version="0.5.0",
    description="Social film diary and discovery. See KASET.md for the product definition.",
    lifespan=lifespan,
)

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
    """Liveness plus which optional integrations are configured. Everything
    listed here is optional — the app serves without any of them."""
    from app.integrations import llm, reddit, websearch

    return {
        "status": "ok",
        "app": "kaset",
        "integrations": {
            "tmdb": bool(settings.TMDB_API_KEY),
            "llm": llm.is_available(),
            "reddit": reddit.is_available(),
            "websearch": websearch.is_available(),
        },
    }
