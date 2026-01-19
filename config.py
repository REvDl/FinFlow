import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr

class Settings(BaseSettings):
    DB_HOST:str
    DB_PORT:int
    DB_USER:str
    DB_PASSWORD: SecretStr
    DB_NAME:str
    DUMMY_HASH: SecretStr
    DUMMY_PASSWORD: SecretStr
    SECRET_KEY: SecretStr
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_MINUTES: int
    URL_API_BANK: str
    CACHE_KEY:str
    CACHE_TTL:int
    REDIS_HOST:str
    REDIS_PORT:int
    @property
    def DATABASE_URL_asyncpg(self):
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD.get_secret_value()}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    model_config = SettingsConfigDict(
        env_file = os.path.join(os.path.dirname(__file__), ".env")
    )


settings = Settings()