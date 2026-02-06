import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, NullPool
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from config import settings
from database.base import Base
from app.main import app
from core.dependencies import get_session
from schemes.user import UserCreate
from database.models import UserOrm, TransactionOrm, RefreshTokenOrm, CategoriesOrm
from services.users import UserDAO


TEST_USER = {"username": "test_user", "password": "test_password"}
UPDATE_USER = {"username": "update_test_user"}


@pytest.mark.asyncio
class TestCreate:
    async def test_create_success(self, client):
        response = await client.post("/auth/register", json=TEST_USER)
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["username"] == "test_user"

    async def test_create_failed(self, authorized_user, session):
        response = await authorized_user.post("/auth/register", json=TEST_USER)
        assert response.status_code == 409


@pytest.mark.asyncio
class TestRead:
    async def test_read_success(self, authorized_user):
        response = await authorized_user.get("/user/")
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "test_user"
        assert "id" in data

    async def test_read_failed(self, authorized_user, session):
        await UserDAO.delete_user(session, authorized_user.user_data["id"])
        await session.commit()
        response = await authorized_user.get("/user/")
        assert response.status_code == 401


@pytest.mark.asyncio
class TestUpdate:
    async def test_update_success(self, authorized_user):
        response = await authorized_user.patch("/user/", json=UPDATE_USER)
        assert response.status_code == 200
        assert response.json()["username"] == "update_test_user"
        assert "id" in response.json()

    async def test_update_failed_data(self, authorized_user):
        response = await authorized_user.patch("/user/", json={"username": "clon"})
        assert response.status_code == 422
        assert response.json()["detail"] == "String should have at least 5 characters"

    async def test_update_failed(self, authorized_user, session):
        await UserDAO.create_user(session, UserCreate(username="taken_username", password=TEST_USER["password"]))
        await session.commit()
        response = await authorized_user.patch("/user/", json={"username": "taken_username"})
        assert response.status_code == 409
        assert response.json()["detail"] == "Username is already taken"


@pytest.mark.asyncio
class TestDelete:
    async def test_delete_success(self, authorized_user, session):
        response = await authorized_user.delete("/user/")
        assert response.status_code == 204

    async def test_delete_failed(self, authorized_user, session):
        await UserDAO.delete_user(session, authorized_user.user_data["id"])
        await session.commit()
        response = await authorized_user.delete("/user/")
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
class TestToken:
    async def test_fake_token(self, client):
        headers = {"Authorization": f"Bearer fake_token_hacker_puper_super"}
        client.headers = headers
        response = await client.get("/user/")
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"
