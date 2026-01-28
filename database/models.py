import datetime
import enum
from typing import Annotated
from sqlalchemy import String, Numeric, ForeignKey, Text, text, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ENUM
from config import settings
from database.base import Base
from decimal import Decimal

intpk = Annotated[int, mapped_column(primary_key=True)]
created_at = Annotated[datetime.datetime, mapped_column(server_default=text("TIMEZONE('utc', now())"))]


def get_expire_time():
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)


class UserOrm(Base):
    __tablename__ = "users"
    id: Mapped[intpk]
    username: Mapped[str] = mapped_column(String(19), unique=True)
    hash_password: Mapped[str] = mapped_column(String(255))
    transactions: Mapped[list["TransactionOrm"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshTokenOrm"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    categories: Mapped[list["CategoriesOrm"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )

class TransactionType(str, enum.Enum):
    income = "income"
    spending = "spending"


class TransactionOrm(Base):
    __tablename__ = "transactions"
    id: Mapped[intpk]
    name: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(String(250), nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"))
    transaction_type: Mapped[TransactionType] = mapped_column(
        ENUM(TransactionType, name="transaction_type", create_type=False),
        name="transaction_type",
        default=TransactionType.spending,
        server_default="spending",
        nullable=False,
    )
    created_at: Mapped[created_at]
    currency: Mapped[str] = mapped_column(String(3), nullable=True)
    user: Mapped["UserOrm"] = relationship(
        back_populates="transactions",
    )
    category: Mapped["CategoriesOrm"] = relationship(
        back_populates="transactions"
    )


class CategoriesOrm(Base):
    __tablename__ = "categories"
    id: Mapped[intpk]
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(50))
    user: Mapped["UserOrm"] = relationship(
        back_populates="categories",
    )
    transactions: Mapped[list["TransactionOrm"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan"
    )


class RefreshTokenOrm(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[intpk]
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(Text, index=True)
    created_at: Mapped[created_at]
    expire_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_expire_time
    )
    user: Mapped["UserOrm"] = relationship(
        back_populates="refresh_tokens"
    )