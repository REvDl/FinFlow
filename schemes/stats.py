from pydantic import BaseModel, Field
from datetime import date
from decimal import Decimal
from typing import Literal

class ChartPointSchema(BaseModel):
    date: date
    transaction_type: Literal["income", "spending"]
    total_amount: Decimal=Field(max_digits=12, decimal_places=2)

    class Config:
        from_attributes = True


class DayTransactionSchema(BaseModel):
    id: int
    name: str
    category: str
    amount: Decimal=Field(max_digits=12, decimal_places=2)
    currency: str
    converted_amount: Decimal=Field(max_digits=12, decimal_places=2)
    display_currency: str

    class Config:
        from_attributes = True