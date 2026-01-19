from fastapi import APIRouter, Depends
from starlette import status

from core.dependencies import get_current_user, get_session
from schemes.user import UserResponse, UserUpdate
from services.users import UserDAO

user_route = APIRouter(prefix="/user", tags=["Users"])



@user_route.get("/", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def about_me(current_user = Depends(get_current_user)):
    return current_user

@user_route.patch("/", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_me(
        user:UserUpdate,
        current_user = Depends(get_current_user),
        session = Depends(get_session)):
    update = await UserDAO.update_user(
        session=session,
        user_id=current_user.id,
        user_update = user
    )
    await session.commit()
    await session.refresh(update)
    return update


@user_route.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
        session = Depends(get_session),
        current_user = Depends(get_current_user)):
    await UserDAO.delete_user(
        session=session,
        user_id=current_user.id
    )
    await session.commit()