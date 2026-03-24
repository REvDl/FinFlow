import datetime
from typing import Literal
from pydantic import BaseModel, Field, condecimal, field_validator
from schemes.transaction import parce_cyrrency_parent, parse_flexible_date


class TransactionData(BaseModel):
    name: str = Field(..., max_length=50)
    description: str | None = Field(default=None, max_length=250)
    price: condecimal(gt=0, max_digits=20, decimal_places=2)
    category_name: str = Field(..., max_length=50)
    created_at: datetime.datetime | None = Field(default=None)
    currency: str | None
    transaction_type: Literal["income", "spending"] = "spending"
    @field_validator("currency", mode="before")
    @classmethod
    def parce_currency(cls, v):
        return parce_cyrrency_parent(v)
    @field_validator("created_at", mode="before")
    @classmethod
    def parse_date(cls, v):
        return parse_flexible_date(v)