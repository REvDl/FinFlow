from typing import Annotated
from fastapi import APIRouter, status, Depends, Query, Request
from core.dependencies import get_session, get_current_user
from core.exceptions import SpendingNotFound, CategoryNotFound
from schemes.spending import SpendingCreate, SpendingResponse, SpendingUpdate, Calendar, Typoi_user, TransactionFilter
from services.categories import CategoryDAO
from services.spending import SpendingDAO

spending_route = APIRouter(
    prefix="/transaction",
    tags=["Transactions"]
)




# ---------- SMART_METHODS ----------

@spending_route.get("/total", status_code=status.HTTP_200_OK)
async def total(request: Request,
                calendar: Calendar = Depends(),
                currency_data: Typoi_user = Depends(),
                how_open: bool = False,
                session=Depends(get_session),
                current_user=Depends(get_current_user)):
    result = await SpendingDAO.total(
        session=session,
        user_id=current_user.id,
        how_open=how_open,
        calendar=calendar,
        to_currency=currency_data.to_currency,
        redis_client=request.app.state.redis,
        http_client=request.app.state.http_client
    )
    return result

# ---------- COLLECTION ----------

@spending_route.post("/", response_model=SpendingResponse, status_code=status.HTTP_201_CREATED)
async def create_spending(
        spending: SpendingCreate,
        session=Depends(get_session),
        current_user=Depends(get_current_user)):
    category = await CategoryDAO.get_by_id(session, spending.category_id)
    if not category or category.user_id != current_user.id:
        raise CategoryNotFound("Category not found")

    new_spending = await SpendingDAO.create_spending(
        session=session,
        user_id=current_user.id,
        spending=spending,
    )
    await session.commit()
    await session.refresh(new_spending)
    return new_spending


@spending_route.get("/", response_model=list[SpendingResponse], status_code=status.HTTP_200_OK)
async def list_spending(transaction: TransactionFilter = Depends(),
                        session=Depends(get_session),
                        current_user=Depends(get_current_user)):
    return await SpendingDAO.read_transaction_all(
        session=session,
        user_id=current_user.id,
        transaction=transaction.type
    )


@spending_route.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_spending(session=Depends(get_session),
                              current_user=Depends(get_current_user)):
    await SpendingDAO.delete_spending_all(
        session=session,
        user_id=current_user.id
    )
    await session.commit()


# ---------- ITEM ----------

@spending_route.get("/{spending_id}", response_model=SpendingResponse, status_code=status.HTTP_200_OK)
async def get_spending(
        spending_id: int,
        session=Depends(get_session),
        current_user=Depends(get_current_user)):
    spending = await SpendingDAO.read_spending_one(
        session=session,
        spending_id=spending_id
    )
    if not spending or spending.user_id != current_user.id:
        raise SpendingNotFound("Spending not found")
    return spending


@spending_route.patch("/{spending_id}", response_model=SpendingResponse, status_code=status.HTTP_200_OK)
async def update_spending(spending_id: int,
                          update: SpendingUpdate,
                          session=Depends(get_session),
                          current_user=Depends(get_current_user)):
    spending = await SpendingDAO.read_spending_one(session, spending_id)
    if not spending or spending.user_id != current_user.id:
        raise SpendingNotFound("Spending not found")

    updated = await SpendingDAO.update_spending(
        session=session,
        update=update,
        spending_id=spending_id,
    )
    await session.commit()
    await session.refresh(updated)
    return updated


@spending_route.delete("/{spending_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spending(spending_id: int,
                          session=Depends(get_session),
                          current_user=Depends(get_current_user)):
    spending = await SpendingDAO.read_spending_one(session, spending_id)
    if not spending or spending.user_id != current_user.id:
        raise SpendingNotFound("Spending not found")

    await SpendingDAO.delete_spending_one(
        session=session,
        spending_id=spending_id
    )
    await session.commit()



