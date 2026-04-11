from datetime import datetime, date
from typing import Literal

from fastapi import APIRouter, Depends, Request, status

from core.dependencies import get_session, get_current_user
from schemes.stats import ChartPointSchema, DayTransactionSchema
from schemes.transaction import Calendar, CurrencyModel
from services.transaction import TransactionDAO

stats = APIRouter(prefix="/stats", tags=["stats"])





@stats.get("/diagram", status_code=status.HTTP_200_OK, response_model=list[ChartPointSchema])
async def get_stats(request:Request,
					session=Depends(get_session),
					current_user=Depends(get_current_user),
					calendar: Calendar = Depends(),
					currency_data: CurrencyModel = Depends()
					):
	result = await TransactionDAO.get_chart_date(
		session=session,
		user_id=current_user.id,
		calendar=calendar,
		to_currency=currency_data.to_currency,
		redis_client=request.app.state.redis,
		http_client=request.app.state.http_client
	)
	return result


# session: AsyncSession,
# user_id: int,
# date: datetime.date,
# transaction_type: str,
# redis_client,
# http_client,
# to_currency: str = "UAH"



@stats.get("/by_day", status_code=status.HTTP_200_OK, response_model=list[DayTransactionSchema])
async def get_transaction_by_day(request: Request,
								 date: date,
								 transaction_type: Literal["income", "spending"],
								 session= Depends(get_session),
								 current_user=Depends(get_current_user),
								 currency_data: CurrencyModel = Depends()
								 ):
	result = await TransactionDAO.get_transaction_by_day(
		session=session,
		user_id=current_user.id,
		date=date,
		transaction_type=transaction_type,
		to_currency=currency_data.to_currency,
		redis_client=request.app.state.redis,
		http_client=request.app.state.http_client
	)
	return result