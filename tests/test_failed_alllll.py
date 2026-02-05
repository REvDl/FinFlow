import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from config import settings

@pytest.mark.asyncio
async def test_minimal_db():
    engine = create_async_engine(settings.DATABASE_TEST_URL_asyncpg)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT 1"))
        result = res.scalar()
        assert result == 1
    await engine.dispose()