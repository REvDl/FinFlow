from datetime import datetime
import httpx
import pytz
from config import settings


def get_now_str():
    tz = pytz.timezone('Europe/Moscow')
    now = datetime.now(tz)
    return now.strftime("%H:%M:%S")




async def send_telegram_msg(client: httpx.AsyncClient, text):
	full_message = f"[{get_now_str()}] {text}"
	url = f"https://api.telegram.org/bot{settings.TOKEN_TG}/sendMessage"
	params = {
		"chat_id": settings.REVDI_ID,
		"text":full_message,
		"parse_mode": "Markdown"
	}
	try:
		response = await client.get(url, params=params, timeout=10.0)
		return response.text
	except Exception as e:
		print(f">>> [TG ERROR] Failed to send message: {e}", flush=True)
		return None


async def notify_all(client: httpx.AsyncClient, message: str):
	print(message, flush=True)
	try:
		await send_telegram_msg(client, message)
	except Exception as e:
		print(f">>> [TG ERROR] {e}")
