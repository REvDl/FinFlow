from fastapi import Response
from config import settings


def set_auth_cookies(response: Response, tokens:dict):
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        max_age= (settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
        httponly=True,
        samesite="lax",
        secure=False,
        path="/"
    )
    if "refresh_token" in tokens:
        response.set_cookie(
            key="refresh_token",
            value=tokens["refresh_token"],
            max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
            httponly=True,
            samesite="lax",
            secure=False,
            path="/"
        )