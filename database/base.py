from sqlalchemy import String
from sqlalchemy.sql.annotation import Annotated
from sqlalchemy.orm import DeclarativeBase
from database.engine import async_engine

str_256 = Annotated[str, 256]


class Base(DeclarativeBase):
    type_annotation_map = {
        str_256: String(256)
    }



class AsyncOrm:
    @staticmethod
    async def create_tables():
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


    @staticmethod
    async def drop_tables():
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)