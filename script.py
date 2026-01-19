import asyncio
from decimal import Decimal
import httpx
import redis.asyncio as redis
from config import settings
import json


async def get_nbu_rates(redis_client: redis.Redis, http_client: httpx.AsyncClient):
    # 1. Сначала Redis
    try:
        cache = await redis_client.get(settings.CACHE_KEY)
        if cache:
            data = json.loads(cache)
            return {k: Decimal(v) for k, v in data.items()}
    except Exception as e:
        print(f"Redis error: {e}")

    # 2. Потом API
    try:
        response = await http_client.get(settings.URL_API_BANK, timeout=5)
        if response.status_code == 200:
            data = response.json()
            rates = {item['cc']: Decimal(str(item['rate'])) for item in data}
            rates["UAH"] = Decimal("1")
            rates["RUB"] = Decimal("0.42")

            # Сохраняем (не падаем, если редис занят)
            await redis_client.set(
                settings.CACHE_KEY,
                json.dumps({k: str(v) for k, v in rates.items()}),
                ex=settings.CACHE_TTL,
            )
            return rates

    except Exception as e:
        print(f"API/Network error: {e}")
    return {
        "UAH": Decimal("1.0"),
        "USD": Decimal("41.2"),
        "EUR": Decimal("44.5"),
        "RUB": Decimal("1.7")
    }