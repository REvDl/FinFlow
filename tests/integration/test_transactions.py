from decimal import Decimal

import pytest
from datetime import datetime

TRANSACTION = {
    "name": "test",
    "description": "test",
    "price": 1,
    "category_id": 1,
    "created_at": "2026-02-06T20:53:25.351Z",
    "currency": "USD",
    "transaction_type": "spending"
}


@pytest.mark.asyncio
class TestCreate:
    async def test_create_transaction_success(self, create_transaction):
        assert create_transaction["name"] == "test"
        assert create_transaction["currency"] == "USD"
        assert create_transaction["transaction_type"] == "spending"

    async def test_create_transaction_russian_currency_success(self, authorized_user, category_create):
        transaction = {**TRANSACTION, "category_id": category_create["id"], "currency": "бакс"}
        response = await authorized_user.post("/transaction/", json=transaction)
        assert response.status_code == 201
        assert response.json()["currency"] == "USD"

    async def test_create_transaction_default_currency_success(self, authorized_user, category_create):
        transaction = {**TRANSACTION, "category_id": category_create["id"], "currency": ""}
        response = await authorized_user.post("/transaction/", json=transaction)
        assert response.status_code == 201
        assert response.json()["currency"] == "UAH"

    async def test_create_transaction_default_date_success(self, authorized_user, category_create):
        transaction = {**TRANSACTION, "category_id": category_create["id"], "created_at": None}
        response = await authorized_user.post("/transaction/", json=transaction)
        assert response.status_code == 201
        assert datetime.strptime(response.json()["created_at"], "%Y-%m-%dT%H:%M:%S.%f")


    @pytest.mark.parametrize(
        "field, value, error", [
            ("created_at", "xyila", f"Формат даты не распознан: 'xyila'"),
            ("transaction_type", "wrong", "Input should be 'income' or 'spending'"),
            ("price", 0, "Input should be greater than 0"),
            ("price", -10, "Input should be greater than 0"),
            ("name", "f" *51, "String should have at most 50 characters"),

        ]
    )
    async def test_create_transaction_validation_failed(self, authorized_user, category_create, field, value, error):
        transaction = {**TRANSACTION, "category_id": category_create["id"], field: value}
        response = await authorized_user.post("/transaction/", json=transaction)
        assert response.status_code == 422
        assert response.json()["detail"] == error


    async def test_create_transaction_not_category(self, authorized_user):
        response = await authorized_user.post("/transaction/", json=TRANSACTION)
        assert response.status_code == 404
        assert response.json()["detail"] == "Category not found"


@pytest.mark.asyncio
class TestRead:
    pass





@pytest.mark.asyncio
class TestUpdate:
    async def test_update_transaction_type_success(self, authorized_user, create_transaction):
        response = await authorized_user.patch(f"/transaction/{create_transaction["id"]}", json={"transaction_type":"income"})
        assert response.status_code == 200
        assert response.json()["transaction_type"] == "income"
        assert response.json()["currency"] == create_transaction["currency"]
        assert response.json()["name"] == create_transaction["name"]


    async def test_update_transaction_category(self, authorized_user, create_transaction, category_create):
        response = await authorized_user.patch(f"/transaction/{create_transaction['id']}", json={"category_id":category_create['id']})
        assert response.status_code == 200
        assert response.json()["category_id"] == category_create['id']



    @pytest.mark.parametrize(
        "field, value",
        [
            ("name", "New Name"),
            ("description", "New description"),
            ("price", 123),
        ]
    )
    async def test_update_transaction_fields_success(self, authorized_user, create_transaction, field, value):
        response = await authorized_user.patch(
            f"/transaction/{create_transaction['id']}",
            json={field: value}
        )
        assert response.status_code == 200
        assert response.json()[field] == int(value) if isinstance(value, float) else value


    @pytest.mark.parametrize(
        "key, value, expected", [
            ("currency", None, "UAH"),
            ("currency", "руб", "RUB"),
            ("currency", "$", "USD")
        ]
    )


    async def test_update_transaction_currency_success(self, authorized_user, create_transaction, key, value, expected):
        response = await authorized_user.patch(f"/transaction/{create_transaction["id"]}", json={key: value})
        assert response.status_code == 200
        assert response.json()["currency"] == expected


    @pytest.mark.parametrize(
        "field, value",
        [
            ("created_at", "xyila"),
            ("transaction_type", "wrong"),
            ("price", 0),
            ("price", -10),
            ("name", "f" * 51),
        ]
    )


    async def test_update_transaction_validation_failed(self, authorized_user, create_transaction, field, value):
        response = await authorized_user.patch(f"/transaction/{create_transaction["id"]}", json={field: value})
        assert response.status_code == 422


    async def test_update_transaction_not_found_failed(self, authorized_user, create_transaction):
        response = await authorized_user.patch("/transaction/100", json={"transaction_type":"income"})
        assert response.status_code == 404
        assert response.json()["detail"] == "Transaction not found"


    async def test_update_transaction_category_not_found_failed(self, authorized_user, create_transaction):
        response = await authorized_user.patch(f"/transaction/{create_transaction["id"]}", json={"category_id":100})
        assert response.status_code == 404
        assert response.json()["detail"] == "Category not found"
