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



	async def test_create_transaction_date_failed(self, authorized_user, category_create):
		transaction = {**TRANSACTION, "category_id": category_create["id"], "created_at": "xyila"}
		response = await authorized_user.post("/transaction/", json=transaction)
		assert response.status_code == 422
		assert response.json()["detail"] == f"Формат даты не распознан: '{transaction["created_at"]}'"


	async def test_create_transaction_type_failed(self, authorized_user, category_create):
		transaction = {**TRANSACTION, "category_id": category_create["id"], "transaction_type": "wrong"}
		response = await authorized_user.post("/transaction/", json=transaction)
		assert response.status_code == 422
		assert response.json()["detail"] == "Input should be 'income' or 'spending'"

	async def test_create_transaction_price_zero_failed(self, authorized_user, category_create):
		transaction = {**TRANSACTION, "category_id": category_create["id"], "price": 0}
		response = await authorized_user.post("/transaction/", json=transaction)
		assert response.status_code == 422
		assert response.json()["detail"] == "Input should be greater than 0"

	async def test_create_transaction_price_negative_failed(self, authorized_user, category_create):
		transaction = {**TRANSACTION, "category_id": category_create["id"], "price": -10}
		response = await authorized_user.post("/transaction/", json=transaction)
		assert response.status_code == 422
		assert response.json()["detail"] == "Input should be greater than 0"

	async def test_create_transaction_failed_validation(self, authorized_user, category_create):
		transaction = {**TRANSACTION, "category_id": category_create["id"], "name": "f" * 51}
		response = await authorized_user.post("/transaction/", json=transaction)
		assert response.status_code == 422
		assert response.json()["detail"] == "String should have at most 50 characters"

	async def test_create_transaction_not_category(self, authorized_user):
		response = await authorized_user.post("/transaction/", json=TRANSACTION)
		assert response.status_code == 404
		assert response.json()["detail"] == "Category not found"
