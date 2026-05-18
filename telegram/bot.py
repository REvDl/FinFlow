from datetime import datetime
import httpx
import pytz
from config import settings
from logger import logger


def get_now_str():
    tz = pytz.timezone('Europe/Kyiv')
    now = datetime.now(tz)
    return now.strftime("%H:%M:%S")




async def send_telegram_msg(client: httpx.AsyncClient, text):
	full_message = f"[{get_now_str()}] {text}"
	url = f"https://api.telegram.org/bot{settings.TOKEN_TG}/sendMessage"
	params = {
		"chat_id": settings.REVDI_ID,
		"text":full_message,
	}
	try:
		response = await client.post(url, json=params, timeout=10.0)
		return response.text
	except Exception as e:
		logger.error(f"[TG ERROR] Failed to send message: {e}")
		return None


async def notify_all(client: httpx.AsyncClient, message: str):
	logger.info(message)
	try:
		await send_telegram_msg(client, message)
	except Exception as e:
		logger.error(f"[TG ERROR] {e}")
