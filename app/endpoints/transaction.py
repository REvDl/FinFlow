import datetime
from typing import Annotated, Optional
from fastapi import APIRouter, status, Depends, Query, Request
from core.dependencies import get_session, get_current_user
from core.exceptions import TransactionNotFound, CategoryNotFound
from schemes.pagination import PaginatedTransactionResponse
from schemes.transaction import TransactionCreate, TransactionResponse, TransactionUpdate, Calendar, CurrencyModel, TransactionFilter
from services.categories import CategoryDAO
from services.transaction import TransactionDAO

transaction_route = APIRouter(
    prefix="/transaction",
    tags=["Transactions"]
)




# ---------- SMART_METHODS ----------

#заменили перспективным юнцом...
# @transaction_route.get("/total", status_code=status.HTTP_200_OK)
# async def total(request: Request,
#                 calendar: Calendar = Depends(),
#                 currency_data: CurrencyModel = Depends(),
#                 how_open: bool = False,
#                 session=Depends(get_session),
#                 current_user=Depends(get_current_user)):
#     result = await TransactionDAO.total(
#         session=session,
#         user_id=current_user.id,
#         how_open=how_open,
#         calendar=calendar,
#         to_currency=currency_data.to_currency,
#         redis_client=request.app.state.redis,
#         http_client=request.app.state.http_client
#     )
#     return result


@transaction_route.get("/total", status_code=status.HTTP_200_OK)
async def total(request: Request,
                calendar: Calendar = Depends(),
                currency_data: CurrencyModel = Depends(),
                session=Depends(get_session),
                current_user=Depends(get_current_user)):
    result = await TransactionDAO.total_for_frontend(
        session=session,
        user_id=current_user.id,
        calendar=calendar,
        to_currency=currency_data.to_currency,
        redis_client=request.app.state.redis,
        http_client=request.app.state.http_client
    )
    return result

# ---------- COLLECTION ----------

@transaction_route.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_spending(
        spending: TransactionCreate,
        session=Depends(get_session),
        current_user=Depends(get_current_user)):
    category = await CategoryDAO.get_by_id(session, spending.category_id)
    if not category or category.user_id != current_user.id:
        raise CategoryNotFound("Category not found")

    new_spending = await TransactionDAO.create_transaction(
        session=session,
        user_id=current_user.id,
        spending=spending,
    )
    await session.commit()
    await session.refresh(new_spending)
    return new_spending


@transaction_route.get("/", response_model=PaginatedTransactionResponse)
async def list_spending(
    # Фильтры (тип транзакции, даты из календаря)
    transaction: TransactionFilter = Depends(),
    calendar: Calendar = Depends(),
    # Параметры пагинации
    limit: int = 20,
    cursor_time: Optional[datetime.datetime] = None,
    cursor_id: Optional[int] = None,
    # Зависимости
    session=Depends(get_session),
    current_user=Depends(get_current_user)
):
    # Вызываем метод DAO, который мы написали ранее
    return await TransactionDAO.read_transaction_all(
        session=session,
        user_id=current_user.id,
        calendar=calendar,
        limit=limit,
        cursor_time=cursor_time,
        cursor_id=cursor_id,
        transaction_type=transaction.type
    )


@transaction_route.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_spending(session=Depends(get_session),
                              current_user=Depends(get_current_user)):
    await TransactionDAO.delete_transaction_all(
        session=session,
        user_id=current_user.id
    )
    await session.commit()


# ---------- ITEM ----------

@transaction_route.get("/{spending_id}", response_model=TransactionResponse, status_code=status.HTTP_200_OK)
async def get_spending(
        spending_id: int,
        session=Depends(get_session),
        current_user=Depends(get_current_user)):
    spending = await TransactionDAO.read_transaction_one(
        session=session,
        spending_id=spending_id
    )
    if not spending or spending.user_id != current_user.id:
        raise TransactionNotFound("Spending not found")
    return spending


@transaction_route.patch("/{spending_id}", response_model=TransactionResponse, status_code=status.HTTP_200_OK)
async def update_spending(spending_id: int,
                          update: TransactionUpdate,
                          session=Depends(get_session),
                          current_user=Depends(get_current_user)):
    spending = await TransactionDAO.read_transaction_one(session, spending_id)
    if not spending or spending.user_id != current_user.id:
        raise TransactionNotFound("Spending not found")

    updated = await TransactionDAO.update_transaction(
        session=session,
        update=update,
        spending_id=spending_id,
    )
    await session.commit()
    await session.refresh(updated)
    return updated


@transaction_route.delete("/{spending_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spending(spending_id: int,
                          session=Depends(get_session),
                          current_user=Depends(get_current_user)):
    spending = await TransactionDAO.read_transaction_one(session, spending_id)
    if not spending or spending.user_id != current_user.id:
        raise TransactionNotFound("Spending not found")

    await TransactionDAO.delete_transaction_one(
        session=session,
        spending_id=spending_id
    )
    await session.commit()



