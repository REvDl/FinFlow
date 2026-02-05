from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from config import settings


async_engine = create_async_engine(
    url = settings.DATABASE_URL_asyncpg,
    echo = True,
    pool_size = 10,
    max_overflow = 20,
)



async_session_factory = async_sessionmaker(
    async_engine,
    expire_on_commit=False,
)
