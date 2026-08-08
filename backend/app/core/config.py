from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/slateclub"
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_REFRESH_SECRET: str = "dev-refresh-secret-change-me"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    TMDB_API_KEY: str = ""
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    FRONTEND_URL: str = "http://localhost:3000"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    # DB index 1 keeps SlateClub isolated from other projects sharing this
    # Redis server (they live on DB 0). Optional — the app degrades gracefully
    # to in-process compute when Redis is unreachable.
    REDIS_URL: str = "redis://localhost:6379/1"
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    OPENAI_LLM_MODEL: str = "gpt-5.5"
    OPENAI_EMBED_MODEL: str = "text-embedding-3-large"
    # Reddit (offline movie-identity enrichment only — never the request path).
    # Empty by default; integrations.reddit.is_available() gates on these, so the
    # extractor degrades to TMDB-only when they're unset. Create a "script" app
    # at reddit.com/prefs/apps to obtain the id + secret.
    REDDIT_CLIENT_ID: str = ""
    REDDIT_CLIENT_SECRET: str = ""
    REDDIT_USER_AGENT: str = "slateclub/1.0 (offline identity enrichment)"
    # Brave Search API — the web-search source for the Community Intelligence
    # Engine (film blogs, listicles, YouTube titles, site:reddit.com threads).
    # Empty by default; integrations.websearch.is_available() gates on it, so the
    # discovery engine degrades to Reddit-only when unset. Free key (1 req/s) at
    # api.search.brave.com. Never the request path — warmer/off-response only.
    BRAVE_SEARCH_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
