from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import CategoriesOrm
from schemes.category import CategoryCreate, CategoryUpdate


class CategoryDAO:
    @staticmethod
    async def create_category(session: AsyncSession, user_id: int, category: CategoryCreate):
        category = CategoriesOrm(**category.model_dump(), user_id=user_id)
        session.add(category)
        await session.flush()
        return category

    @staticmethod
    async def get_by_id(session: AsyncSession, category_id: int):
        return await session.get(CategoriesOrm, category_id)

    @staticmethod
    async def get_by_user(session: AsyncSession, user_id: int):
        query = select(CategoriesOrm).filter_by(user_id=user_id)
        result = await session.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_category_obj(session: AsyncSession, category: CategoriesOrm, update: CategoryUpdate):
        data = update.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(category, key, value)
        await session.flush()
        return category

    @staticmethod
    async def delete_by_id(session: AsyncSession, category_id: int):
        delete_category = await session.get(CategoriesOrm, category_id)
        if delete_category:
            await session.delete(delete_category)
            await session.flush()
            return True
        return False

    @staticmethod
    async def delete_category_all(session: AsyncSession, user_id: int):
        query = delete(CategoriesOrm).filter_by(user_id=user_id)
        result = await session.execute(query)
        if result.rowcount > 0:
            return True
        return False
