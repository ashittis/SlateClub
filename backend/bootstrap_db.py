import asyncio

from app.core.database import engine, Base
from app import models_registry  # noqa: F401


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("create_all done")


if __name__ == "__main__":
    asyncio.run(main())
