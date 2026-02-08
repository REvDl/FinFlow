import httpx
import pytest
import pytest_asyncio
from app.main import app
from database.models import UserOrm
from app.endpoints.user import get_session, get_current_user
from schemes.user import UserResponse

transport = httpx.ASGITransport(app=app)





@pytest_asyncio.fixture
async def async_app_client():
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()



@pytest.fixture
def mock_auth():
    def _setup(user):
        app.dependency_overrides[get_current_user] = lambda: user
        return user
    return _setup


@pytest.fixture
def mock_dao_delete(mocker):
    def _mock(return_value):
        return mocker.patch("services.users.UserDAO.delete_user", return_value=return_value)
    return _mock


@pytest.fixture
def mock_session(mocker):
    session = mocker.AsyncMock()
    session.refresh = mocker.AsyncMock(return_value=None)
    app.dependency_overrides[get_session] = lambda: session
    return session

@pytest.mark.asyncio
async def test_read_user(async_app_client, mock_auth):
    mock_auth(UserOrm(id=1, username="test_user"))
    response = await async_app_client.get("/user/")
    assert response.status_code == 200
    valid_data = UserResponse.model_validate(response.json())
    assert valid_data.id == 1
    assert valid_data.username == "test_user"

@pytest.mark.asyncio
async def test_update_user(async_app_client, mocker, mock_auth, mock_session):
    mock_auth(UserOrm(id=1, username="test_user"))
    mock_update_user = UserOrm(id=1, username="new_username")
    mocker.patch("services.users.UserDAO.update_user", return_value=mock_update_user)
    response = await async_app_client.patch("/user/", json={"username":"new_username"})
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_user_two_cases(async_app_client, mock_auth, mock_dao_delete, mock_session):
    mock_auth(UserOrm(id=1, username="test_user"))
    mock_dao = mock_dao_delete(True)
    response = await async_app_client.delete("/user/")
    assert response.status_code == 204
    assert response.text == ""
    mock_session.commit.assert_called_once()
    mock_dao.return_value = False
    response_failed = await async_app_client.delete("/user/")
    assert response_failed.status_code == 404