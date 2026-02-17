import datetime
from decimal import Decimal
from typing import Any, Literal
from pydantic import BaseModel, Field, condecimal, field_validator, model_validator, ConfigDict
from dateutil import parser

from core.exceptions import DataError
from database.models import TransactionType


class RussianParserInfo(parser.parserinfo):
    MONTHS = [
        ('Янв', 'Январь'), ('Фев', 'Февраль'), ('Мар', 'Март'),
        ('Апр', 'Апрель'), ('Май', 'Май'), ('Июн', 'Июнь'),
        ('Июл', 'Июль'), ('Авг', 'Август'), ('Сен', 'Сентябрь'),
        ('Окт', 'Октябрь'), ('Ноя', 'Ноябрь'), ('Дек', 'Декабрь')
    ]
    WEEKDAYS = [
        ('Пн', 'Понедельник'), ('Вт', 'Вторник'),
        ('Ср', 'Среда'), ('Чт', 'Четверг'),
        ('Пт', 'Пятница'), ('Сб', 'Суббота'),
        ('Вс', 'Воскресенье')
    ]

#константа но не капсом
CurrencyManager = {
    "usd": "USD", "доллар": "USD", "бакс": "USD", "$": "USD",
    "uah": "UAH", "гривна": "UAH", "грн": "UAH", "₴": "UAH",
    "eur": "EUR", "евро": "EUR", "€": "EUR",
    "czk": "CZK", "крона": "CZK", "крон": "CZK", "kc": "CZK",
    "rub": "RUB", "рубль": "RUB", "рубли": "RUB", "₽": "RUB", "руб": "RUB",
}


RU_INFO = RussianParserInfo()

def parce_cyrrency_parent(v: Any):
    if not v:
        return "UAH"
    clean_v = str(v.strip().lower())
    if clean_v in CurrencyManager:
        return CurrencyManager[clean_v]
    if clean_v.upper() in CurrencyManager.values():
        return clean_v.upper()
    raise DataError("В базе данных такой валюты нет")


def parse_flexible_date(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    dt = v
    if isinstance(v, str):
        try:
            dt = parser.parse(v, dayfirst=True, parserinfo=RU_INFO)
        except (parser.ParserError, ValueError):
            # Фолбек на стандартный парсер (ISO и прочее)
            try:
                dt = parser.parse(v, dayfirst=True)
            except (parser.ParserError, ValueError):
                raise DataError(f"Формат даты не распознан: '{v}'")
    if isinstance(dt, datetime.datetime):
        return dt.replace(tzinfo=None)
    return dt


class CurrencyModel(BaseModel):
    to_currency: Literal["UAH", "RUB", "EUR", "USD", "CZK"] = "UAH"
    @field_validator("to_currency", mode="before")
    @classmethod
    def parce_currency(cls, v):
        return parce_cyrrency_parent(v)



class TransactionCreate(BaseModel):
    name: str = Field(..., max_length=50)
    description: str | None = Field(default=None, max_length=250)
    price: condecimal(gt=0, max_digits=20, decimal_places=2)
    category_id: int
    created_at: datetime.datetime | None = Field(default_factory=lambda: datetime.datetime.now())
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



class TransactionResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: Decimal
    category_id: int
    category_name: str | None = None
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)
    currency: str
    transaction_type: str


class TransactionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=250)
    price: condecimal(gt=0, max_digits=20, decimal_places=2) | None = None
    category_id: int | None = None
    created_at: datetime.datetime | None = None
    currency: str | None = None
    transaction_type: TransactionType | None = None
    @field_validator("currency", mode="before")
    @classmethod
    def parce_currency(cls, v):
        return parce_cyrrency_parent(v)
    @field_validator("created_at", mode="before")
    @classmethod
    def validate_date(cls, v):
        return parse_flexible_date(v)





class Calendar(BaseModel):
    start: Any | None = Field(default=None, description="Дата от")
    end: Any | None = Field(default=None, description="Дата до")
    @field_validator("start", "end", mode="before")
    @classmethod
    def validate_start_end(cls, v):
        parse_correct = parse_flexible_date(v)
        if isinstance(parse_correct, datetime.datetime):
            return parse_correct.date()
        return parse_correct
    @model_validator(mode="after")
    def check_date(self):
        if self.start and self.end and self.end < self.start:
            raise DataError("End date cannot be earlier than the start date")
        return self



class TransactionFilter(BaseModel):
    type: Literal["income", "spending", "all"] = "all"