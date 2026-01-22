import datetime
from pydantic import BaseModel
from typing import List, Optional
from schemes.transaction import TransactionResponse


class CursorData(BaseModel):
    cursor_time: datetime.datetime
    cursor_id: int

class PaginatedTransactionResponse(BaseModel):
    items: List[TransactionResponse]
    next_cursor: Optional[CursorData] = None
    has_more: bool