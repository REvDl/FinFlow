import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from app.main import app
from database.base import Base
from core.dependencies import get_session
from config import settings
from tests.integration.test_categories import CATEGORY
from tests.integration.test_transactions import TRANSACTION
from tests.integration.test_user import TEST_USER

# Глобальный флаг, чтобы не пересоздавать таблицы для каждого теста
_tables_initialized = False


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    global _tables_initialized
    engine = create_async_engine(
        settings.DATABASE_TEST_URL_asyncpg,
        poolclass=NullPool
    )
    #если таблицы еще не создавали, то вот щас создадим
    if not _tables_initialized:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.execute(text("DROP TYPE IF EXISTS transaction_type CASCADE;"))
            await conn.execute(text("CREATE TYPE transaction_type AS ENUM ('spending', 'income');"))
            await conn.run_sync(Base.metadata.create_all)
        _tables_initialized = True

    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def session(async_engine):
    async with async_engine.connect() as connection:
        #транзакция для отката
        transaction = await connection.begin()
        async with AsyncSession(connection, expire_on_commit=False) as session:
            yield session
            # Откатываем данные, но таблицы не трогаем
            await transaction.rollback()


@pytest_asyncio.fixture(scope="function")
async def client(session):
    app.dependency_overrides[get_session] = lambda: session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def authorized_user(client):
    await client.post("/auth/register", json=TEST_USER)
    login_res = await client.post("/auth/login", json=TEST_USER)

    data = login_res.json()
    token = data["tokens"]["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    client.user_data = data["user"]
    yield client


@pytest_asyncio.fixture(scope="function")
async def category_create(authorized_user):
    category = await authorized_user.post("/categories/", json=CATEGORY)
    data = category.json()
    yield data
    await authorized_user.delete(f"/categories/{data['id']}")


@pytest_asyncio.fixture(scope="function")
async def create_transaction(authorized_user, category_create):
    transaction_data = TRANSACTION.copy()
    transaction_data["category_id"] = category_create["id"]
    transaction = await authorized_user.post("/transaction/", json=transaction_data)
    assert transaction.status_code == 201
    data = transaction.json()
    yield data
    await authorized_user.delete(f"/transaction/{data['id']}")