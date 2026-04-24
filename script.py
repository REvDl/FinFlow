import asyncio
from decimal import Decimal
import httpx
import redis.asyncio as redis
from config import settings
import json


#Валюти які потрібні, щоб не брати усі курси з NBU
USED_CURRENCIES = {"UAH", "USD", "EUR", "RUB", "PLN", "CZK"}
RUB = Decimal("0.59")

async def nbu_update(redis_client: redis.Redis, http_client: httpx.AsyncClient):
    """парсить валюту банку"""
    try:
        print("PARSER: NBU UPDATE START")
        response = await http_client.get(settings.URL_API_BANK, timeout=5)
        if response.status_code == 200:
            data = response.json()
            rates = {item['cc']: Decimal(str(item['rate'])) for item in data}
            rates["UAH"] = Decimal("1")
            rates["RUB"] = RUB
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



# Створюємо глобальний прапор, щоб якщо кешу немає, то 3 одночасні запити не робили 3 http-запити до банку, простіше кажучи
# Проблема Race Condition
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
        "RUB": RUB,
        "PLN": Decimal("12.17")
    }
