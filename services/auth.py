from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import AuthUserAlreadyExists, AuthInvalidLoginOrPassword
from core.security import create_access_token, create_refresh_token, verify_password
from database.models import UserOrm
from schemes.user import UserCreate
from services.refresh import RefreshTokenDAO
from services.users import UserDAO

class AuthService:
    @staticmethod
    async def create_session(session:AsyncSession, user:UserOrm):
        token_data = {"username":user.username}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        await RefreshTokenDAO.add_token(session=session, token=refresh_token, user_id=user.id)
        return  {
            "access_token":access_token,
            "refresh_token":refresh_token,
            "token_type":"bearer"
        }


    @staticmethod
    async def register(session:AsyncSession, user:UserCreate):
        existing_user = await UserDAO.read_user_username(session=session, username=user.username)
        if existing_user:
            raise AuthUserAlreadyExists("User already exists")
        new_user = await UserDAO.create_user(session=session, user=user)
        tokens = await AuthService.create_session(session=session, user=new_user)
        return {"user": new_user, "tokens": tokens}


    @staticmethod
    async def login(session:AsyncSession, user_data:UserCreate):
        user = await UserDAO.read_user_username(session=session, username=user_data.username)
        if not user or not verify_password(user_data.password, user.hash_password):
            raise AuthInvalidLoginOrPassword("Invalid login or password")
        tokens = await AuthService.create_session(session=session, user=user)
        return {"user": user, "tokens": tokens}

