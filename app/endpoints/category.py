from fastapi import APIRouter, status, Depends

from core.dependencies import get_session, get_current_user
from core.exceptions import CategoryNotFound
from schemes.category import CategoryResponse, CategoryCreate, CategoryUpdate
from schemes.transaction import TransactionResponse
from services.categories import CategoryDAO
from services.spending import TransactionDAO

category_route = APIRouter(prefix="/categories", tags=["Categories"])


@category_route.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(category_data: CategoryCreate,
                          session=Depends(get_session),
                          current_user=Depends(get_current_user)):
    category = await CategoryDAO.create_category(
        session=session,
        user_id=current_user.id,
        category=category_data
    )
    await session.commit()
    await session.refresh(category)
    return category


@category_route.get("/", response_model=list[CategoryResponse], status_code=status.HTTP_200_OK)
async def get_category_user(
        session=Depends(get_session),
        current_user=Depends(get_current_user)):
    categories = await CategoryDAO.get_by_user(
        session=session,
        user_id=current_user.id
    )
    return categories




@category_route.get("/{category_id}", response_model=list[TransactionResponse], status_code=status.HTTP_200_OK)
async def get_category(category_id: int,
                       session=Depends(get_session),
                       current_user=Depends(get_current_user)):
    spendings = await TransactionDAO.read_transaction_category(
        session=session,
        category_id=category_id,
        user_id=current_user.id
    )
    if not spendings:
        raise CategoryNotFound("No spendings for this category")
    return spendings


@category_route.patch("/{category_id}", response_model=CategoryResponse, status_code=status.HTTP_200_OK)
async def update_category(category_id: int,
                          update: CategoryUpdate,
                          session=Depends(get_session),
                          current_user=Depends(get_current_user)
                          ):
    category = await CategoryDAO.get_by_id(session, category_id)
    if not category or category.user_id != current_user.id:
        raise CategoryNotFound("Category not found")
    category = await CategoryDAO.update_category_obj(
        session=session,
        category=category,
        update=update
    )
    await session.commit()
    await session.refresh(category)
    return category


@category_route.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int,
                          session=Depends(get_session),
                          current_user=Depends(get_current_user)
                          ):
    category = await CategoryDAO.get_by_id(
        session=session,
        category_id=category_id)
    if not category or category.user_id != current_user.id:
        raise CategoryNotFound("Category not found")

    await CategoryDAO.delete_by_id(
        session=session,
        category_id=category_id
    )
    await session.commit()


@category_route.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_category(session=Depends(get_session),
                              current_user=Depends(get_current_user)):
    await CategoryDAO.delete_category_all(
        session=session,
        user_id=current_user.id
    )
    await session.commit()
