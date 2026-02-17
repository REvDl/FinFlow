from decimal import Decimal
from http.client import responses

import pytest
from datetime import datetime, timezone

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
            ("name", "f" * 51, "String should have at most 50 characters"),

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
    async def test_read_transaction_success(self, authorized_user, create_transaction):
        response = await authorized_user.get(f"/transaction/{create_transaction["id"]}")
        assert response.status_code == 200
        assert response.json()["name"] == create_transaction["name"]
        assert response.json()["created_at"] == create_transaction["created_at"]
        assert response.json()["id"] == create_transaction["id"]

    async def test_read_transactions_pagination_success(self, authorized_user, create_multiple_transaction):
        limit = 3
        page_one = await authorized_user.get(f"/transaction/?limit={limit}")
        assert page_one.status_code == 200
        data_one = page_one.json()
        items_one = data_one["items"]
        cursor = data_one["next_cursor"]
        assert len(data_one["items"]) == limit
        assert cursor["cursor_id"] is not None
        assert cursor["cursor_time"] is not None
        params = {
            "limit": limit,
            "cursor_id": cursor["cursor_id"],
            "cursor_time": cursor["cursor_time"]
        }
        page_two = await authorized_user.get(f"/transaction/", params=params)
        assert page_two.status_code == 200
        data_two = page_two.json()
        items_two = data_two["items"]
        assert items_two[0]["id"] < items_one[-1]["id"]
        ids_one = {item["id"] for item in items_one}
        ids_two = {item["id"] for item in items_two}
        assert ids_one.isdisjoint(ids_two)

    async def test_read_transactions_pagination_calendar_not_created_success(self, authorized_user,
                                                                             create_multiple_transaction):
        page_one = await authorized_user.get(f"/transaction/?limit=3&start=2027.02.12&end=2027.02.12")
        assert page_one.status_code == 200
        data = page_one.json()
        assert len(data["items"]) == 0
        assert data["items"] == []
        assert data["next_cursor"] is None

    async def test_read_transaction_pagination_calendar_one_day_success(self, authorized_user,
                                                                        create_multiple_transaction):
        target_date = "2026-02-06"
        response = await authorized_user.get(f"/transaction/?limit=3&start={target_date}&end=2026-02-07")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["items"][0]["created_at"].startswith("2026-07-02") or data["items"][0]["created_at"].startswith(
            "2026-06-02")


    async def test_read_total_success(self, authorized_user, create_multiple_transaction, currency_redis):
        params = {"to_currency": "EUR"}
        response = await authorized_user.get("/transaction/total", params=params)
        assert response.status_code == 200
        assert response.json()["balance"] == -8


    async def test_read_balance_success(self, authorized_user, create_multiple_transaction, currency_redis):
        params = {"to_currency": "EUR"}
        transaction = {**TRANSACTION, "price": 100, "transaction_type":"income"}
        response_transaction = await authorized_user.post("/transaction/", json=transaction)
        assert response_transaction.status_code == 201
        response = await authorized_user.get("/transaction/total", params=params)
        assert response.status_code == 200
        assert response.json()["balance"] == 72.0


    async def test_read_total_currency_not_found_failed(self, authorized_user, create_multiple_transaction):
        params = {"to_currency": "BIT"}
        response = await authorized_user.get("/transaction/total", params=params)
        assert response.status_code == 422
        assert response.json()["detail"] == "Input should be 'UAH', 'RUB', 'EUR', 'USD' or 'CZK'"


    async def test_read_transaction_not_found_failed(self, authorized_user):
        response = await authorized_user.get("/transaction/100")
        assert response.status_code == 404
        assert response.json()["detail"] == "Transaction not found"

@pytest.mark.asyncio
class TestUpdate:
    async def test_update_transaction_type_success(self, authorized_user, create_transaction):
        response = await authorized_user.patch(f"/transaction/{create_transaction["id"]}",
                                               json={"transaction_type": "income"})
        assert response.status_code == 200
        assert response.json()["transaction_type"] == "income"
        assert response.json()["currency"] == create_transaction["currency"]
        assert response.json()["name"] == create_transaction["name"]

    async def test_update_transaction_category(self, authorized_user, create_transaction, category_create):
        response = await authorized_user.patch(f"/transaction/{create_transaction['id']}",
                                               json={"category_id": category_create['id']})
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
        actual_value = response.json()[field]
        if field == "price":
            assert Decimal(str(actual_value)) == Decimal(str(value))
        else:
            assert actual_value == value

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
        response = await authorized_user.patch("/transaction/100", json={"transaction_type": "income"})
        assert response.status_code == 404
        assert response.json()["detail"] == "Transaction not found"

    async def test_update_transaction_category_not_found_failed(self, authorized_user, create_transaction):
        response = await authorized_user.patch(f"/transaction/{create_transaction["id"]}", json={"category_id": 100})
        assert response.status_code == 404
        assert response.json()["detail"] == "Category not found"


@pytest.mark.asyncio
class TestDelete:
    async def test_delete_transaction_success(self, authorized_user, create_transaction):
        response = await authorized_user.delete(f"/transaction/{create_transaction['id']}")
        assert response.status_code == 204

    async def test_delete_all_transactions_success(self, authorized_user, create_multiple_transaction):
        response = await authorized_user.delete(f"/transaction/")
        assert response.status_code == 204
        response_two = await authorized_user.get("/transaction/?limit=3")
        assert response_two.status_code == 200
        assert response_two.json()["items"] == []

    async def test_delete_transaction_not_found_failed(self, authorized_user):
        response = await authorized_user.delete("/transaction/100")
        assert response.status_code == 404
        assert response.json()["detail"] == "Transaction not found"
