import datetime
from fastapi import APIRouter, Depends, status, Response
from app.utils import set_auth_cookies
from core.dependencies import get_session
from core.exceptions import TokenHasExpired, UserNotFound
from schemes.user import UserCreate, UserResponse, UserLogin
from services.auth import AuthService
from services.refresh import RefreshTokenDAO
from services.users import UserDAO

auth_route = APIRouter(prefix="/auth", tags=["Auth"])


@auth_route.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, session=Depends(get_session)):
    new_user = await AuthService.register(session, user_data)
    await session.commit()
    await session.refresh(new_user["user"])
    return {
        "user": UserResponse.model_validate(new_user["user"]),
        "tokens": new_user["tokens"]
    }


@auth_route.post("/login", status_code=status.HTTP_200_OK)
async def login(response: Response, user_data: UserLogin, session=Depends(get_session)):
    user = await AuthService.login(session, user_data)
    await session.commit()
    await session.refresh(user["user"])
    set_auth_cookies(response, user["tokens"])
    return {
        "user": UserResponse.model_validate(user["user"]),
        "tokens": user["tokens"]
    }


@auth_route.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(response: Response,
                  refresh_token: str,
                  session=Depends(get_session)):
    token = await RefreshTokenDAO.get_token(
        session=session,
        token=refresh_token
    )
    if not token or token.expire_at < datetime.datetime.now(datetime.timezone.utc):
        raise TokenHasExpired("Token has expired")
    user = await UserDAO.read_user(session=session, user_id=token.user_id)
    if not user:
        raise UserNotFound("User not found")
    await session.delete(token)
    set_auth_cookies(response, user["tokens"])
    return await AuthService.create_session(session=session, user=user)


@auth_route.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Successfully logged out"}