import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from core.security import create_refresh_token
from database.models import RefreshTokenOrm


class RefreshTokenDAO:
    @staticmethod
    async def add_token(session: AsyncSession, token: str, user_id:int):
        await session.execute(
            delete(RefreshTokenOrm).where(RefreshTokenOrm.user_id == user_id,
                                          RefreshTokenOrm.expire_at < datetime.datetime.now(datetime.timezone.utc)
        ))
        new_token = RefreshTokenOrm(token=token,user_id=user_id)
        session.add(new_token)
        await session.flush()
        return new_token


    @staticmethod
    async def get_token(session: AsyncSession, token:str):
        query = select(RefreshTokenOrm).where(RefreshTokenOrm.token == token)
        result = await session.execute(query)
        return result.scalar_one_or_none()


    @staticmethod
    async def delete_token(session: AsyncSession, token:str):
        query = delete(RefreshTokenOrm).where(RefreshTokenOrm.token == token)
        result = await session.execute(query)
        await session.flush()
        return result.rowcount > 0