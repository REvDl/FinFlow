import datetime
from fastapi import APIRouter, Depends, status, Response, Cookie, BackgroundTasks
from pygments.styles.dracula import background

from app.utils import set_auth_cookies
from core.dependencies import get_session
from core.exceptions import TokenHasExpired, UserNotFound
from schemes.user import UserCreate, UserResponse, UserLogin
from services.auth import AuthService
from services.refresh import RefreshTokenDAO
from services.users import UserDAO
from limiter.limiter import limiter
from fastapi import Request

from telegram.bot import notify_all

auth_route = APIRouter(prefix="/auth", tags=["Auth"])


@auth_route.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(background_tasks: BackgroundTasks, request:Request, response: Response, user_data: UserCreate, session=Depends(get_session)):
    new_user = await AuthService.register(session, user_data)
    #отправка сообщения с именем юзера UserCreate.username
    await session.commit()
    await session.refresh(new_user["user"])
    set_auth_cookies(response, new_user["tokens"])
    background_tasks.add_task(notify_all, request.app.state.http_client, f"Новый юзер {user_data.username}")
    return {
        "user": UserResponse.model_validate(new_user["user"]),
        "tokens": new_user["tokens"]
    }


@auth_route.post("/login", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def login(request:Request, response: Response, user_data: UserLogin, session=Depends(get_session)):
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
                  refresh_token: str = Cookie(None),
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
    new_session = await AuthService.create_session(session=session, user=user)
    set_auth_cookies(response, new_session)
    await session.commit()
    return {
        "user": user,
        "tokens": new_session
    }


@auth_route.post("/logout")
async def logout(response: Response,
                 refresh_token: str = Cookie(None),
                 session=Depends(get_session)):
    cookies_to_delete = ["access_token", "refresh_token"]
    for token in cookies_to_delete:
        response.delete_cookie(
            key=token,
            httponly=True,
            samesite="lax",
            secure=False,
            path="/",
        )
    if refresh_token:
        token = await RefreshTokenDAO.delete_token(
            session=session,
            token=refresh_token)
        await session.commit()
    return {"message": "Successfully logged out"}