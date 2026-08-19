from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All configuration, read from `backend/.env`. This is the only place the
    app reads the environment — never call os.getenv elsewhere.

    Every external service below is optional and availability-gated. Kaset must
    start and serve without Redis, Reddit, Brave, or an LLM key; discovery simply
    falls back to serving whatever is already cached.
    """

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5433/kaset"

    JWT_SECRET: str = "dev-secret-change-me"
    JWT_REFRESH_SECRET: str = "dev-refresh-secret-change-me"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    TMDB_API_KEY: str = ""
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"

    # Comma-separated; split into the CORS allowlist in main.py.
    FRONTEND_URL: str = "http://localhost:3000"

    # DB index 1 keeps Kaset isolated from other projects sharing this Redis
    # server (they live on DB 0). Optional — the app degrades to in-process
    # compute when Redis is unreachable.
    REDIS_URL: str = "redis://localhost:6379/1"

    # ── Discovery engine ────────────────────────────────────────────────────
    # The LLM does candidate extraction and final evaluation only; it never
    # invents recommendations. See KASET.md §9.
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-5.5"
    # Set to point the OpenAI-compatible client at another provider's endpoint.
    LLM_BASE_URL: str = ""

    # Reddit — the primary discovery evidence source. Offline/warmer only, never
    # the request path. integrations.reddit.is_available() gates on these, so
    # collection degrades to web-only when unset. Create a "script" app at
    # reddit.com/prefs/apps to obtain the id + secret.
    REDDIT_CLIENT_ID: str = ""
    REDDIT_CLIENT_SECRET: str = ""
    REDDIT_USER_AGENT: str = "kaset/1.0 (offline discovery evidence collection)"

    # Brave Search — the secondary evidence source (film sites, blogs,
    # recommendation articles, YouTube metadata). integrations.websearch
    # gates on it, so collection degrades to Reddit-only when unset. Free key
    # (1 req/s) at api.search.brave.com. Warmer/off-response only.
    BRAVE_SEARCH_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
