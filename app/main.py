from contextlib import asynccontextmanager
import redis.asyncio as redis
import httpx
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse
from app.endpoints.auth import auth_route
from app.endpoints.category import category_route
from app.endpoints.spending import spending_route
from app.endpoints.user import user_route
from config import settings
from core.exceptions import ERROR_MAP, FinFlowException
from database.base import AsyncOrm
from database.engine import async_engine


async def init_db():
    async_engine.echo = False
    # await AsyncOrm.drop_tables()
    await AsyncOrm.create_tables()
    print("\033[32mINFO:\033[0m     Database reset and created successfully")
    async_engine.echo = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    app.state.http_client = httpx.AsyncClient()
    app.state.redis = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=True,
        max_connections=10,
    )
    try:
        yield
    finally:
        await app.state.redis.close()
        await app.state.http_client.aclose()
        print("\033[32mINFO:\033[0m     Resources closed successfully")


app = FastAPI(lifespan=lifespan)

@app.exception_handler(FinFlowException)
async def fin_flow_exception(request: Request, exc: FinFlowException):
    status_code = ERROR_MAP.get(type(exc), status.HTTP_400_BAD_REQUEST)
    return JSONResponse(
        status_code=status_code,
        content={"detail":exc.detail}
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception(request: Request, exc: RequestValidationError):
    error_message = exc.errors()[0]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": error_message.get("msg")
        }
    )

app.include_router(auth_route)
app.include_router(user_route)
app.include_router(spending_route)
app.include_router(category_route)