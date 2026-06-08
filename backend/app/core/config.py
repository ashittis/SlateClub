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

    class Config:
        env_file = ".env"


settings = Settings()
