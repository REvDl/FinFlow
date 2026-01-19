from pydantic import BaseModel, Field, ConfigDict


class UserCreate(BaseModel):
    username: str = Field(..., min_length=5, max_length=19)
    password: str = Field(..., min_length=12, max_length=64)


class UserLogin(UserCreate):
    password: str = Field(...)


class UserResponse(BaseModel):
    id: int
    username: str

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=5, max_length=19)
    password: str | None = Field(default=None, min_length=12, max_length=64)
