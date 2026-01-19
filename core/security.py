import datetime
from core.exceptions import TokenHasExpired, TokenInvalid, TokenVerificationFailed, TokenMissing, TokenMissingType
from database.models import RefreshTokenOrm
from fastapi import Depends
from passlib.handlers.argon2 import argon2
from fastapi.security import HTTPBearer
from config import settings
from schemes.user import UserCreate
import jwt



def hash_password(password):
    return argon2.hash(password)



def verify_password(password: str | None, password_hash: str | None):
    hash_for_verif = password_hash if password_hash else settings.DUMMY_HASH.get_secret_value()
    password_for_verif = password if password else settings.DUMMY_PASSWORD.get_secret_value()
    is_valid = False
    try:
        is_valid = argon2.verify(password_for_verif, hash_for_verif)
    except Exception:
        pass
    return is_valid and password_hash is not None




def create_token(data:dict, token_type:str, expire_time:int):
    to_encode = data.copy()
    now = datetime.datetime.now(datetime.timezone.utc)
    exp = now + datetime.timedelta(minutes=expire_time)
    to_encode.update({
     "iat":now,
     "exp":exp,
     "sub":to_encode.get("username"),
     "type":token_type,
    })
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY.get_secret_value(),
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt

def create_access_token(data:dict):
    access_token = create_token(data, "access", settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return access_token



def create_refresh_token(data:dict):
    refresh_token = create_token(data, "refresh", settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    return refresh_token


def verify_token(token:str, token_type:str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY.get_secret_value(), algorithms=[settings.ALGORITHM])
        if payload.get("type") != token_type:
            raise TokenMissingType(f"Not an {token_type} token")
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenHasExpired("The token has expired")
    except jwt.PyJWTError:
        raise TokenInvalid("Invalid token")
    except Exception:
        raise TokenVerificationFailed("Token verification failed")


def verify_access_token(token: str):
    if not token:
        raise TokenMissing("Missing token")
    return verify_token(token, "access")



def verify_refresh_token(token: str): # То же самое
    if not token:
        raise TokenMissing("Missing token")
    return verify_token(token, "refresh")
