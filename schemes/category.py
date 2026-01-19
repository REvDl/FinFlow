from pydantic import BaseModel, Field, ConfigDict


class CategoryCreate(BaseModel):
    name: str = Field(min_length=3, max_length=50)


class CategoryResponse(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class CategoryUpdate(BaseModel):
    name: str | None = Field(min_length=3, max_length=50)
