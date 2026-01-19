from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import TokenInvalid, TokenMissing
from core.security import verify_token, verify_access_token
from database.engine import async_session_factory
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from services.users import UserDAO
from fastapi import Request, Depends


oauth2_scheme = HTTPBearer(auto_error=False)


async def get_session():
    async with async_session_factory() as session:
        yield session



async def get_token_request(
        request:Request,
        auth: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
):
    token = request.cookies.get("access_token")
    if not token and auth:
        token = auth.credentials
    if not token:
        raise TokenMissing("Token not found in cookies or header")
    return token


async def get_current_user(token: str = Depends(get_token_request),
                           session: AsyncSession = Depends(get_session)):
    payload = verify_access_token(token)
    if not payload:
        raise TokenInvalid("Invalid credentials")
    username = payload.get("username")
    if username is None:
        raise TokenInvalid("Invalid credentials")
    user = await UserDAO.read_user_username(session=session, username=username)
    if user is None:
        raise TokenInvalid("Invalid credentials")
    return user