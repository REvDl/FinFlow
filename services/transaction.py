import datetime
import json
from decimal import Decimal
from typing import Any, Coroutine, Sequence
from sqlalchemy import select, delete, func, cast, Date, extract, tuple_, case, Nullable, text, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from database.models import UserOrm, TransactionOrm, CategoriesOrm, TransactionType
from schemes.transaction import TransactionCreate, TransactionUpdate, Calendar, CurrencyModel
from script import get_nbu_rates


class TransactionDAO:
	@staticmethod
	async def create_transaction(session: AsyncSession, user_id: int, spending: TransactionCreate):
		if not spending.created_at:
			print("DEBUG: Date is missing! Using system now().")
			spending.created_at = datetime.datetime.now()
		print(f"DEBUG: Final date to save: {spending.created_at}")
		new_spending = TransactionOrm(**spending.model_dump(), user_id=user_id)
		session.add(new_spending)
		await session.flush()
		query = select(CategoriesOrm.name).filter_by(id=new_spending.category_id)
		result = await session.execute(query)
		cat_name = result.scalar_one_or_none()

		new_spending.category_name = cat_name
		return new_spending

	@staticmethod
	async def create_transactions_import(session: AsyncSession, user_id: int, valid_data: list):
		unique_category_names = {t.category_name for t in valid_data}
		stmt = select(CategoriesOrm).filter(
			CategoriesOrm.user_id == user_id,
			CategoriesOrm.name.in_(unique_category_names)
		)
		result = await session.execute(stmt)
		existing_categories = result.scalars().all()
		category_map = {c.name: c.id for c in existing_categories}
		missing_names = unique_category_names - set(category_map.keys())
		if missing_names:
			new_cats = [CategoriesOrm(user_id=user_id, name=name) for name in missing_names]
			session.add_all(new_cats)
			await session.flush()  # Чтобы база выдала ID новым категориям
			# Добавляем новые ID в нашу мапу
			for nc in new_cats:
				category_map[nc.name] = nc.id
		to_insert = []
		for t in valid_data:
			data = t.model_dump()
			cat_name = data.pop("category_name")
			data["category_id"] = category_map[cat_name]
			data["user_id"] = user_id
			to_insert.append(data)

		# 5. Выполняем массовую вставку всех транзакций одним запросом
		if to_insert:
			await session.execute(insert(TransactionOrm).values(to_insert))

		return len(to_insert)

	@staticmethod
	async def read_transaction_one(session: AsyncSession, spending_id: int):
		return await session.get(TransactionOrm, spending_id)

	@staticmethod
	async def read_transaction_for_file(session: AsyncSession,
										user_id: int):
		stmt = text("""
			SELECT json_agg(t) FROM (
				SELECT t.id, t.name, t.description, t.price, c.name as category_name, 
					   t.created_at, t.currency, t.transaction_type
				FROM transactions t
				JOIN categories c ON t.category_id = c.id
				WHERE t.user_id = :user_id
			) t
		""")
		result = await session.execute(stmt, {"user_id": user_id})
		json_result = result.scalar()
		if json_result:
			data = json.dumps(json_result, indent=4, ensure_ascii=False)
			return data
		return "[]"

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

	@staticmethod
	async def convert_currency(redis_client,
							   http_client,
							   to_currency: str = "UAH"):
		rates = await get_nbu_rates(redis_client, http_client)
		target_rate = rates.get(to_currency.upper(), Decimal("1"))
		transaction_currency_cases = []
		for currency, rate in rates.items():
			multiplier = rate / target_rate
			transaction_currency_cases.append(
				(TransactionOrm.currency == currency, TransactionOrm.price * multiplier)
			)
		converted_price = case(*transaction_currency_cases, else_=TransactionOrm.price / target_rate)
		return converted_price

	# перспективный юнец
	@staticmethod
	async def total_for_frontend(
			session: AsyncSession,
			user_id: int,
			calendar: Calendar,
			redis_client,
			http_client,
			to_currency: str = "UAH",
	):
		converted_price = await TransactionDAO.convert_currency(redis_client, http_client, to_currency)
		total_query = (
			select(
				func.sum(
					case((TransactionOrm.transaction_type == TransactionType.income, converted_price), else_=0)).label(
					"total_income"),
				func.sum(case((TransactionOrm.transaction_type == TransactionType.spending, converted_price),
							  else_=0)).label(
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

	@staticmethod
	async def get_average_period(session: AsyncSession,
								 user_id: int,
								 calendar: Calendar,
								 redis_client,
								 http_client,
								 to_currency: str = "UAH"):
		total = await TransactionDAO.total_for_frontend(
			session=session,
			user_id=user_id,
			calendar=calendar,
			to_currency=to_currency,
			redis_client=redis_client,
			http_client=http_client
		)
		start_date = calendar.start or datetime.date.today()
		end_date = calendar.end or datetime.date.today()
		days = max((end_date - start_date).days + 1, 1)
		return {
			"average_spending": round(total.get("spending", 0) / days, 2),
			"average_income": round(total.get("income", 0) / days, 2),
			"days": days,
			"to_currency": to_currency
		}

	@staticmethod
	async def date_all_time(session: AsyncSession,
							user_id: int):
		query = (
			select(
				func.coalesce(func.min(TransactionOrm.created_at), datetime.datetime.now()),
				func.coalesce(func.max(TransactionOrm.created_at), datetime.datetime.now())
			)
			.where(TransactionOrm.user_id == user_id)
		)
		result = await session.execute(query)
		min_data, max_data = result.fetchone()
		return {
			"min_data": min_data,
			"max_data": max_data
		}

	@staticmethod
	async def get_chart_date(session: AsyncSession,
							 user_id: int,
							 calendar: Calendar,
							 redis_client,
							 http_client,
							 to_currency: str = "UAH"
							 ):

		converted_price = await TransactionDAO.convert_currency(redis_client, http_client, to_currency)
		query = (
			select(
				cast(TransactionOrm.created_at, Date).label("date"),
				TransactionOrm.transaction_type,
				func.sum(converted_price).label("total_amount")
			)
			.where(TransactionOrm.user_id == user_id)
			.group_by("date", TransactionOrm.transaction_type)
			.order_by("date")
		)
		query = TransactionDAO.date_calendar(query, calendar)
		result = await session.execute(query)
		rows = result.all()

		stats = {(row.date, row.transaction_type): row.total_amount for row in rows}
		final_stats = []
		start_dt = calendar.start or datetime.date.today().replace(day=1)
		end_dt = calendar.end or datetime.date.today()
		current_dt = start_dt
		PRECISION = Decimal("0.01")
		while current_dt <= end_dt:
			for t_type in ['income', 'spending']:
				raw_amount = Decimal(stats.get((current_dt, t_type), 0))
				amount = raw_amount.quantize(PRECISION)
				final_stats.append({
					"date": current_dt,
					"transaction_type": t_type,
					"total_amount": amount
				})
			current_dt += datetime.timedelta(days=1)
		return final_stats


	@staticmethod
	async def get_transaction_by_day(
			session: AsyncSession,
			user_id: int,
			date: datetime.date,
			transaction_type: str,
			redis_client,
			http_client,
			to_currency: str = "UAH"
	):
		converted_price = await TransactionDAO.convert_currency(redis_client, http_client, to_currency)
		query = (
			select(
				TransactionOrm.id,
				TransactionOrm.name,
				TransactionOrm.price.label("original_amount"),
				TransactionOrm.currency.label("original_currency"),
				converted_price.label("converted_amount"),
				CategoriesOrm.name.label("category_name")
			)
			.join(CategoriesOrm, TransactionOrm.category_id == CategoriesOrm.id)
			.where(
				TransactionOrm.user_id == user_id,
				cast(TransactionOrm.created_at, Date) == date,
				TransactionOrm.transaction_type == transaction_type
			)
			.order_by(TransactionOrm.created_at.desc())
		)

		result = await session.execute(query)
		rows = result.all()
		return [
			{
				"id": row.id,
				"name": row.name,
				"category": row.category_name,
				"amount": Decimal(row.original_amount),
				"currency": row.original_currency,
				"converted_amount": Decimal(row.converted_amount).quantize(Decimal("0.01")),
				"display_currency": to_currency.upper()
			}
			for row in rows
		]
