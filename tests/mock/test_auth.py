import datetime
import httpx
import pytest
from unittest.mock import AsyncMock
import pytest_asyncio
from app.main import app
from database.models import UserOrm
from app.endpoints.auth import get_session

transport = httpx.ASGITransport(app=app)



@pytest_asyncio.fixture
async def async_app_client():
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _test_auth_success(async_app_client,
                             mocker,
                             *,
                             service_method:str,
                             url_endpoint:str,
                             expected_status_code:int):
    payload = {
        "username": "testuser",
        "password": "testpassword123456"
    }
    mock_user = UserOrm(id=1, username="testuser")
    mock_result = {
        "user": mock_user,
        "tokens": {"access_token": "fake_access", "refresh_token": "fake_refresh"}
    }
    route = mocker.patch(service_method, return_value=mock_result)
    mock_session = mocker.AsyncMock()
    mock_session.refresh = mocker.AsyncMock()
    async def override_get_session():
        yield mock_session
    app.dependency_overrides[get_session] = override_get_session


    if url_endpoint == "refresh":
        mock_token = AsyncMock()
        mock_token.expire_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
        mock_token.user_id = 1
        mocker.patch("app.endpoints.auth.RefreshTokenDAO.get_token", return_value=mock_token)
        mocker.patch("app.endpoints.auth.UserDAO.read_user", return_value=mock_result)
        mocker.patch(
            "app.endpoints.auth.AuthService.create_session",
            return_value={"session": "ok"}
        )
        response = await async_app_client.post(f"/auth/{url_endpoint}", params={"refresh_token": "valid_refresh_token"})
        assert response.status_code == expected_status_code

    if url_endpoint == "register" or url_endpoint == "login":
        response = await async_app_client.post(f"/auth/{url_endpoint}", json=payload)
        data = response.json()
        assert "user" in data
        assert "access_token" in data["tokens"]
        assert "refresh_token" in data["tokens"]
        assert data["tokens"]["access_token"] == "fake_access"
        assert data["tokens"]["refresh_token"] == "fake_refresh"
        assert response.status_code == expected_status_code
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_register_success(async_app_client, mocker):
    await _test_auth_success(async_app_client,
                             mocker,
                             service_method="app.endpoints.auth.AuthService.register",
                             url_endpoint="register",
                             expected_status_code=201)



@pytest.mark.asyncio
async def test_login_success(async_app_client, mocker):
    await _test_auth_success(async_app_client,
                             mocker,
                             service_method="app.endpoints.auth.AuthService.login",
                             url_endpoint="login",
                             expected_status_code=200)




@pytest.mark.asyncio
async def test_refresh_success(async_app_client, mocker):
    await _test_auth_success(async_app_client,
                             mocker,
                             service_method="app.endpoints.auth.AuthService.create_session",
                             url_endpoint="refresh",
                             expected_status_code=200)



@pytest.mark.asyncio
async def test_refresh_v1(async_app_client, mocker):
    mock_token = AsyncMock()
    mock_token.expire_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    mock_token.user_id = 1
    mocker.patch("app.endpoints.auth.RefreshTokenDAO.get_token", return_value=mock_token)
    #получаем юзера, имитация точнее
    mock_user = UserOrm(id=1, username="testuser")
    mock_result = {
        "user": mock_user,
        "tokens": {"access_token": "fake_access", "refresh_token": "fake_refresh"}
    }
    mocker.patch("app.endpoints.auth.UserDAO.read_user", return_value=mock_result)
    #сессия
    mocker.patch(
        "app.endpoints.auth.AuthService.create_session",
        return_value={"session": "ok"}
    )
    mock_session = mocker.AsyncMock()
    mock_session.delete = mocker.AsyncMock()
    async def override_get_session():
        yield mock_session
    app.dependency_overrides[get_session] = override_get_session
    response = await async_app_client.post(f"/auth/refresh", params={"refresh_token":"valid_refresh_token"})
    assert response.status_code == 200
