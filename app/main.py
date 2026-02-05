from contextlib import asynccontextmanager
import redis.asyncio as redis
import httpx
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse
from app.endpoints.auth import auth_route
from app.endpoints.category import category_route
from app.endpoints.transaction import transaction_route
from app.endpoints.user import user_route
from config import settings
from core.exceptions import ERROR_MAP, FinFlowException
from database.engine import async_engine, async_session_factory
from database.base import AsyncOrm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient()
    app.state.redis = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=True,
        max_connections=10,
        socket_timeout=0.05,
        socket_connect_timeout=0.05
    )
    try:
        yield
    finally:
        await app.state.redis.close()
        await app.state.http_client.aclose()
        await async_engine.dispose()
        print("\033[32mINFO:\033[0m     Resources closed successfully")


app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:63342",
    "http://127.0.0.1:63342",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(transaction_route)
app.include_router(category_route)