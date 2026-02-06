import pytest

CATEGORY = {"name": "category_test"}
CATEGORY_UPDATE = {"name": "update_category"}


@pytest.mark.asyncio
class TestNonAuthorized:
    async def test_create_category(self, client):
        response = await client.post("/categories/", json=CATEGORY)
        assert response.status_code == 401
        assert response.json()["detail"] == "Token not found in cookies or header"

    async def test_read_category(self, client):
        response = await client.get("/categories/")
        assert response.status_code == 401
        assert response.json()["detail"] == "Token not found in cookies or header"

    async def test_update_category(self, client):
        response = await client.patch("/categories/1", json=CATEGORY_UPDATE)
        assert response.status_code == 401
        assert response.json()["detail"] == "Token not found in cookies or header"

    async def test_delete_category(self, client):
        response = await client.delete("/categories/1")
        assert response.status_code == 401
        assert response.json()["detail"] == "Token not found in cookies or header"


@pytest.mark.asyncio
class TestCreate:
    async def test_create_category_success(self, authorized_user):
        response = await authorized_user.post("/categories/", json=CATEGORY)
        assert response.status_code == 201
        assert response.json()["name"] == "category_test"
        assert "id" in response.json()

    async def test_create_category_invalid_name(self, authorized_user):
        response = await authorized_user.post("/categories/", json={"name": "no"})
        assert response.status_code == 422
        assert response.json()["detail"] == "String should have at least 3 characters"


@pytest.mark.asyncio
class TestRead:
    async def test_read_category_success(self, authorized_user, category_create):
        response = await authorized_user.get("/categories/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        for item in response.json():
            assert isinstance(item, dict)
            assert "id" in item
            assert "name" in item
            assert isinstance(item["id"], int)
            assert isinstance(item["name"], str)

@pytest.mark.asyncio
class TestUpdate:
    async def test_update_category_success(self, authorized_user, category_create):
        response = await authorized_user.patch(f"/categories/{category_create["id"]}", json=CATEGORY_UPDATE)
        assert response.status_code == 200
        assert response.json()["name"] == "update_category"

    async def test_update_category_failed_invalid_name(self, authorized_user, category_create):
        response = await authorized_user.patch(f"/categories/{category_create["id"]}", json={"name": "no"})
        assert response.status_code == 422
        assert response.json()["detail"] == "String should have at least 3 characters"

    async def test_update_category_failed_not_found(self, authorized_user):
        response = await authorized_user.patch("/categories/1", json=CATEGORY_UPDATE)
        assert response.status_code == 404
        assert response.json()["detail"] == "Category not found"




@pytest.mark.asyncio
class TestDelete:
    async def test_delete_category_success(self, authorized_user, category_create):
        response = await authorized_user.delete(f"/categories/{category_create["id"]}")
        assert response.status_code == 204


    async def test_delete_category_failed_not_found(self, authorized_user, category_create):
        response = await authorized_user.delete("/categories/1")
        assert response.status_code == 404
        assert response.json()["detail"] == "Category not found"