import asyncio
from decimal import Decimal
import httpx
import redis.asyncio as redis
from config import settings
import json


#Валюты которые нужны, чтоб не брать все курсы из NBU
USED_CURRENCIES = {"UAH", "USD", "EUR", "CZK", "RUB"}


async def nbu_update(redis_client: redis.Redis, http_client: httpx.AsyncClient):
    """парсит валюту банка"""
    try:
        print("PARSER: NBU UPDATE START")
        response = await http_client.get(settings.URL_API_BANK, timeout=5)
        if response.status_code == 200:
            data = response.json()
            rates = {item['cc']: Decimal(str(item['rate'])) for item in data}
            rates["UAH"] = Decimal("1")
            #Хардкодим рубль, потому что нбу банк не отдает курс рубля
            rates["RUB"] = Decimal("0.57")
            rates = {k: v for k, v in rates.items() if k in USED_CURRENCIES}
            await redis_client.set(
                settings.CACHE_KEY,
                json.dumps({k: str(v) for k, v in rates.items()}),
                ex=settings.CACHE_TTL,
            )
            print("PARSER: NBU UPDATE FINISHED")
            return rates

    except Exception as e:
        print(f"API/Network error: {e}")



#Создаем глобальный флаг, чтоб если кэша нет, то 3 одновременных запроса не делали 3 http запроса к банку, проще говоря
#Проблема Race Condition
_update_nbu_ = None


async def get_nbu_rates(redis_client: redis.Redis, http_client: httpx.AsyncClient):
    global _update_nbu_
    try:
        print("GET_NBU_RATES CALLED")
        cache = await redis_client.get(settings.CACHE_KEY)
        if cache:
            data = json.loads(cache)
            return {k: Decimal(v) for k, v in data.items()}
    except Exception as e:
        print(f"Redis error: {e}")

    if _update_nbu_ is None or _update_nbu_.done():
        _update_nbu_ = asyncio.create_task(nbu_update(redis_client, http_client))
    await _update_nbu_
    return {
        "UAH": Decimal("1.0"),
        "USD": Decimal("41.2"),
        "EUR": Decimal("44.5"),
        "CZK": Decimal("2.11"),
        "RUB": Decimal("0.57"),
    }
