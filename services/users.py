from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from core.exceptions import UserAlreadyExists
from database.models import UserOrm
from core.security import hash_password
from schemes.user import UserCreate, UserUpdate
from sqlalchemy.ext.asyncio import AsyncSession

class UserDAO:
    @staticmethod
    async def create_user(session: AsyncSession, user:UserCreate):
        new_user = UserOrm(username=user.username, hash_password=hash_password(user.password))
        session.add(new_user)
        await session.flush()
        return new_user


    @staticmethod
    async def read_user(session: AsyncSession, user_id:int):
        return await session.get(UserOrm, user_id)

    @staticmethod
    async def read_user_username(session: AsyncSession, username:str):
        query = select(UserOrm).filter_by(username=username)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def update_user(session: AsyncSession, user_id:int, user_update:UserUpdate):
        user = await session.get(UserOrm, user_id)
        if not user:
            return None
        data = user_update.model_dump(exclude_unset=True)
        for key, value in data.items():
            if key == "password":
                setattr(user, "hash_password", hash_password(value))
            elif hasattr(user, key):
                setattr(user, key, value)
        try:
            await session.flush()
            return user
        except IntegrityError:
            await session.rollback()
            raise UserAlreadyExists("Username is already taken")



    @staticmethod
    async def delete_user(session: AsyncSession, user_id:int):
        user = await session.get(UserOrm, user_id)
        if user:
            await session.delete(user)
            await session.flush()
            return True
        return False