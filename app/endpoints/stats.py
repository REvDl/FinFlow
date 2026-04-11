from fastapi import APIRouter, Depends, Request
from core.dependencies import get_session, get_current_user
from schemes.transaction import Calendar, CurrencyModel
from services.transaction import TransactionDAO

stats = APIRouter(prefix="/stats", tags=["stats"])





@stats.get("/stats")
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