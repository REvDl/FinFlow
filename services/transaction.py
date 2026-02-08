import datetime
from collections import defaultdict
from decimal import Decimal
from typing import Any, Coroutine, Sequence
from sqlalchemy import select, delete, func, cast, Date, extract, tuple_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from database.models import UserOrm, TransactionOrm, CategoriesOrm, TransactionType
from schemes.transaction import TransactionCreate, TransactionUpdate, Calendar, CurrencyModel
from script import get_nbu_rates


class TransactionDAO:
    @staticmethod
    async def create_transaction(session: AsyncSession, user_id: int, spending: TransactionCreate):
        new_spending = TransactionOrm(**spending.model_dump(), user_id=user_id)
        session.add(new_spending)
        await session.flush()
        query = select(CategoriesOrm.name).filter_by(id=new_spending.category_id)
        result = await session.execute(query)
        cat_name = result.scalar_one_or_none()

        new_spending.category_name = cat_name
        return new_spending

    @staticmethod
    async def read_transaction_one(session: AsyncSession, spending_id: int):
        return await session.get(TransactionOrm, spending_id)

    @staticmethod
    async def read_transaction_all(session: AsyncSession,
                                   calendar: Calendar,
                                   user_id: int,
                                   limit: int = 20,
                                   cursor_time: datetime.datetime | None = None,
                                   cursor_id: int | None = None,
                                   category_id: int | None = None,
                                   transaction_type: str | None = "all"
                                   ):
        query = (
            select(TransactionOrm, CategoriesOrm.name)
            .join(CategoriesOrm, TransactionOrm.category_id == CategoriesOrm.id)
            .filter(TransactionOrm.user_id == user_id)
        )

        if category_id:
            query = query.filter(TransactionOrm.category_id == category_id)

        if transaction_type != "all":
            query = query.filter(TransactionOrm.transaction_type == transaction_type)

        query = TransactionDAO.date_calendar(query=query, calendar=calendar)

        if cursor_time and cursor_id:
            query = query.filter(
                tuple_(TransactionOrm.created_at, TransactionOrm.id) < (cursor_time, cursor_id)
            )
        query = (query
                 .order_by(TransactionOrm.created_at.desc(),
                           TransactionOrm.id.desc())
                 .limit(limit + 1)
                 )
        result = await session.execute(query)
        rows = result.all()
        has_more = len(rows) > limit
        rows = rows[:limit]

        items = []
        for transaction_obj, cat_name in rows:
            transaction_obj.category_name = cat_name
            items.append(transaction_obj)

        next_cursor = None
        if items and has_more:
            last = items[-1]
            next_cursor = {
                "cursor_time": last.created_at,
                "cursor_id": last.id,
            }

        return {
            "items": items,
            "next_cursor": next_cursor,
            "has_more": has_more,
        }


    @staticmethod
    async def update_transaction(session: AsyncSession, update: TransactionUpdate, spending_id: int):
        spending = await session.get(TransactionOrm, spending_id)
        if not spending:
            return None
        data = update.model_dump(exclude_unset=True)
        for key, value in data.items():
            if hasattr(spending, key):
                setattr(spending, key, value)
        await session.flush()
        return spending

    @staticmethod
    async def delete_transaction_one(session: AsyncSession, spending_id: int):
        delete_transaction = await session.get(TransactionOrm, spending_id)
        if delete_transaction:
            await session.delete(delete_transaction)
            await session.flush()
            return True
        return False

    @staticmethod
    async def delete_transaction_all(session: AsyncSession, user_id: int):
        query = delete(TransactionOrm).filter_by(user_id=user_id)
        result = await session.execute(query)
        if result.rowcount > 0:
            return True
        return False

    @staticmethod
    def date_calendar(query, calendar: Calendar):
        # 1. Если пользователь САМ выбрал диапазон
        if calendar.start and calendar.end:
            start_dt = datetime.datetime.combine(calendar.start, datetime.time.min).replace(tzinfo=None)
            end_dt = datetime.datetime.combine(calendar.end, datetime.time.max).replace(tzinfo=None)
            return query.filter(TransactionOrm.created_at.between(start_dt, end_dt))
        # 2. Если пользователь выбрал конкретный день
        if calendar.start and not calendar.end:
            start_dt = datetime.datetime.combine(calendar.start, datetime.time.min).replace(tzinfo=None)
            end_dt = datetime.datetime.combine(calendar.start, datetime.time.max).replace(tzinfo=None)
            return query.filter(TransactionOrm.created_at.between(start_dt, end_dt))
        if not calendar.start and not calendar.end:
            now = datetime.datetime.now()
            # Начало текущего месяца: 2026-01-01 00:00:00
            first_day_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(TransactionOrm.created_at >= first_day_of_month)
        return query


    #перспективный юнец
    @staticmethod
    async def total_for_frontend(
            session: AsyncSession,
            user_id: int,
            calendar: Calendar,
            redis_client,
            http_client,
            to_currency: str = "UAH",
    ):
        rates = await get_nbu_rates(redis_client, http_client)
        target_rate = rates.get(to_currency.upper(), Decimal("1"))
        transaction_currency = []
        for currency, rate in rates.items():
            multiplier = rate / target_rate
            transaction_currency.append((TransactionOrm.currency == currency, TransactionOrm.price * multiplier))
        converted_price = case(*transaction_currency, else_=TransactionOrm.price / target_rate)
        total_query = (
            select(
                func.sum(case((TransactionOrm.transaction_type == TransactionType.income, converted_price), else_=0)).label(
                    "total_income"),
                func.sum(case((TransactionOrm.transaction_type == TransactionType.spending, converted_price), else_=0)).label(
                    "total_spending")
            )
            .filter(TransactionOrm.user_id == user_id)
        )
        total_query = TransactionDAO.date_calendar(total_query, calendar)
        cat_query = (
            select(
                CategoriesOrm.name,
                func.sum(converted_price).label("sum")
            )
            .join(CategoriesOrm, TransactionOrm.category_id == CategoriesOrm.id)
            .filter(TransactionOrm.user_id == user_id, TransactionOrm.transaction_type == TransactionType.spending)
        )
        cat_query = TransactionDAO.date_calendar(cat_query, calendar).group_by(CategoriesOrm.name)

        # Выполняем оба запроса
        total_res = await session.execute(total_query)
        cat_res = await session.execute(cat_query)

        total_row = total_res.one()
        income = total_row.total_income or Decimal('0')
        spending = total_row.total_spending or Decimal('0')
        categories_data = {row.name: float(round(row.sum, 2)) for row in cat_res.all()}

        return {
            "balance": round(income - spending, 2),
            "income": round(income, 2),
            "spending": round(spending, 2),
            "currency": to_currency.upper(),
            "categories": categories_data
        }