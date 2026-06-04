import asyncio

from app.core.database import engine, Base
from app.models import (  # noqa: F401
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
)


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("create_all done")


if __name__ == "__main__":
    asyncio.run(main())
