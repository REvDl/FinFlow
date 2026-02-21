import asyncio
import datetime
import json
import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from app.main import app, lifespan
from database.base import Base
from core.dependencies import get_session
from config import settings
from tests.integration.test_categories import CATEGORY
from tests.integration.test_transactions import TRANSACTION
from tests.integration.test_user import TEST_USER
import fakeredis
from unittest.mock import patch
# Глобальный флаг, чтобы не пересоздавать таблицы для каждого теста
_tables_initialized = False


@pytest.fixture(scope="function")
def disable_limiter_properly():
    from limiter.limiter import limiter
    original_state = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = original_state


@pytest_asyncio.fixture(scope="function", autouse=True)
def redis_server():
    fake = fakeredis.aioredis.FakeRedis()
    app.state.redis = fake
    return fake

@pytest_asyncio.fixture()
async def currency_redis(redis_server):
    fake_rates = {
        "USD": "40.0",
        "EUR": "50.0",
        "UAH": "1.0"
    }
    await redis_server.set(settings.CACHE_KEY, json.dumps(fake_rates))


_shared_engine = None
@pytest_asyncio.fixture(scope="function")
async def async_engine():
    global _tables_initialized, _shared_engine
    if _shared_engine is None:
        _shared_engine = create_async_engine(
            settings.DATABASE_TEST_URL_asyncpg,
            poolclass=NullPool
        )

    # Таблицы тоже только один раз
    if not _tables_initialized:
        async with _shared_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.execute(text("DROP TYPE IF EXISTS transaction_type CASCADE;"))
            await conn.execute(text("CREATE TYPE transaction_type AS ENUM ('spending', 'income');"))
            await conn.run_sync(Base.metadata.create_all)
        _tables_initialized = True

    yield _shared_engine



@pytest_asyncio.fixture(scope="function")
async def session(async_engine):
    async with async_engine.connect() as connection:
        transaction = await connection.begin()
        async with AsyncSession(connection, expire_on_commit=False) as session:
            yield session
            await transaction.rollback()


@pytest_asyncio.fixture(scope="function")
async def client(session):
    app.dependency_overrides[get_session] = lambda: session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        app.state.http_client = ac
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def authorized_user(client, disable_limiter_properly):
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
    return data


@pytest_asyncio.fixture(scope="function")
async def create_transaction(authorized_user, category_create):
    transaction_data = TRANSACTION.copy()
    transaction_data["category_id"] = category_create["id"]
    transaction = await authorized_user.post("/transaction/", json=transaction_data)
    assert transaction.status_code == 201
    data = transaction.json()
    return data


@pytest_asyncio.fixture(scope="function")
async def create_multiple_transaction(authorized_user, category_create, disable_limiter_properly):
    data = []
    base_date = datetime.datetime.fromisoformat(TRANSACTION["created_at"])
    for i in range(10):
        transaction_data = TRANSACTION.copy()
        transaction_data["category_id"] = category_create["id"]
        new_date = base_date + datetime.timedelta(days=i)
        transaction_data["created_at"] = new_date.isoformat()
        transaction = await authorized_user.post("/transaction/", json=transaction_data)
        assert transaction.status_code == 201
        data.append(transaction.json())
    return data