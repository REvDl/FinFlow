import datetime
from collections import defaultdict
from decimal import Decimal
from typing import Any, Coroutine, Sequence
from sqlalchemy import select, delete, func, cast, Date, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models import UserOrm, SpendingOrm, CategoriesOrm
from schemes.spending import SpendingCreate, SpendingUpdate, Calendar
from script import get_nbu_rates


class SpendingDAO:
    @staticmethod
    async def create_spending(session: AsyncSession, user_id: int, spending: SpendingCreate):
        new_spending = SpendingOrm(**spending.model_dump(), user_id=user_id)
        session.add(new_spending)
        await session.flush()
        # чтоб выводилось и название категории
        query = select(CategoriesOrm.name).filter_by(id=new_spending.category_id)
        result = await session.execute(query)
        cat_name = result.scalar_one_or_none()

        new_spending.category_name = cat_name
        return new_spending

    @staticmethod
    async def read_spending_one(session: AsyncSession, spending_id: int):
        return await session.get(SpendingOrm, spending_id)

    @staticmethod
    async def read_transaction_all(session: AsyncSession, user_id: int, transaction: str):
        query = (
            select(SpendingOrm, CategoriesOrm.name)
            .join(CategoriesOrm, SpendingOrm.category_id == CategoriesOrm.id)
            .filter(SpendingOrm.user_id == user_id)
        )
        if transaction != "all":
            query = query.filter(SpendingOrm.transaction == transaction)
        query = query.order_by(SpendingOrm.created_at.desc())
        result = await session.execute(query)
        all_spendings = []
        for spending_obj, cat_name in result.all():
            spending_obj.category_name = cat_name
            all_spendings.append(spending_obj)

        return all_spendings

    @staticmethod
    async def read_spending_category(session: AsyncSession, category_id: int, user_id: int):
        query = (
            select(SpendingOrm)
            # Добавляем колонку с именем категории и называем её как в Pydantic схеме
            .add_columns(CategoriesOrm.name.label("category_name"))
            .join(CategoriesOrm, SpendingOrm.category_id == CategoriesOrm.id)
            .filter(SpendingOrm.category_id == category_id, SpendingOrm.user_id == user_id)
            .order_by(SpendingOrm.created_at.desc())
        )

        result = await session.execute(query)
        spendings = []
        for spending_obj, cat_name in result.all():
            spending_obj.category_name = cat_name
            spendings.append(spending_obj)
        return spendings

    @staticmethod
    async def update_spending(session: AsyncSession, update: SpendingUpdate, spending_id: int):
        spending = await session.get(SpendingOrm, spending_id)
        if not spending:
            return None
        data = update.model_dump(exclude_unset=True)
        for key, value in data.items():
            if hasattr(spending, key):
                setattr(spending, key, value)
        await session.flush()
        return spending

    @staticmethod
    async def delete_spending_one(session: AsyncSession, spending_id: int):
        delete_spending = await session.get(SpendingOrm, spending_id)
        if delete_spending:
            await session.delete(delete_spending)
            await session.flush()
            return True
        return False

    @staticmethod
    async def delete_spending_all(session: AsyncSession, user_id: int):
        query = delete(SpendingOrm).filter_by(user_id=user_id)
        result = await session.execute(query)
        if result.rowcount > 0:
            return True
        return False


    @staticmethod
    def date_calendar(query, calendar: Calendar):
        if calendar.start and not calendar.end:
            # сли пришел только start то вернем как раз траты в этот день (в этот start)
            query = query.filter(
                cast(SpendingOrm.created_at, Date) == calendar.start
            )
        elif calendar.start and calendar.end:
            # если оба пришли, то делаем временной период от start до end
            query = query.filter(
                cast(SpendingOrm.created_at, Date).between(calendar.start, calendar.end)
            )
        else:
            # иначе вернем все траты этого месяца этого года
            query = query.filter(
                extract("month", SpendingOrm.created_at) == extract("month", func.now()),
                extract("year", SpendingOrm.created_at) == extract("year", func.now()),
            )
        return query

    @staticmethod
    async def total(
            session: AsyncSession,
            user_id: int,
            calendar: Calendar,
            redis_client,
            http_client,
            how_open: bool = False,
            to_currency: str = "UAH"
    ):
        rates = await get_nbu_rates(redis_client, http_client)
        target_rate = rates.get(to_currency.upper(), Decimal("1"))

        query = (
            select(SpendingOrm, CategoriesOrm.name)
            .join(CategoriesOrm, SpendingOrm.category_id == CategoriesOrm.id)
            .filter(SpendingOrm.user_id == user_id)
        )
        query = SpendingDAO.date_calendar(query, calendar)
        result = await session.execute(query)

        total_income = Decimal("0")
        total_spending = Decimal("0")

        # Чтобы не плодить пустые списки items, если how_open=False
        def category_factory():
            base = {"total": Decimal("0"), "income": Decimal("0"), "spending": Decimal("0")}
            if how_open:
                base["items"] = []
            return base

        categories_data = defaultdict(category_factory)

        # Итерируемся напрямую по результату (экономим память)
        for s, cat_name in result:
            source_rate = rates.get(s.currency.upper() if s.currency else "UAH", Decimal("1"))
            converted = round((s.price * source_rate) / target_rate, 2)

            if s.transaction == "income":
                total_income += converted
                categories_data[cat_name]["income"] += converted
            else:
                total_spending += converted
                categories_data[cat_name]["spending"] += converted

            if how_open:
                categories_data[cat_name]["items"].append({
                    "name": s.name,
                    "amount": converted,
                    "type": s.transaction,
                    "date": s.created_at.strftime("%d.%m.%Y")
                })

        # Считаем итого по каждой категории ПОСЛЕ цикла
        for cat in categories_data.values():
            cat["total"] = cat["income"] - cat["spending"]

        # Сортируем один раз в самом конце
        sorted_cats = dict(sorted(
            categories_data.items(),
            key=lambda x: x[1]["spending"],
            reverse=True
        ))

        return {
            "balance": total_income - total_spending,
            "total_income": total_income,
            "total_spending": total_spending,
            "currency": to_currency.upper(),
            "categories": sorted_cats
        }