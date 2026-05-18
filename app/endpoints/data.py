import datetime
import io
import json
from typing import List, Annotated, Any
from fastapi.responses import JSONResponse
from fastapi import APIRouter, status, Depends, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import TypeAdapter

from config import settings
from logger import logger
from core.dependencies import get_session, get_current_user
from core.exceptions import BrokenFileError, LargeFileSize
from schemes.data import TransactionData
from schemes.transaction import TransactionCreate
from services.transaction import TransactionDAO

data = APIRouter(
    prefix="/data",
    tags=["Data"]
)


@data.get("/export", status_code=status.HTTP_200_OK)
async def export_data(session=Depends(get_session),
                      current_user=Depends(get_current_user)):
    data = await TransactionDAO.read_transaction_for_file(
        session=session,
        user_id=current_user.id
    )
    file_like = io.BytesIO(data.encode("utf-8"))
    filename = f"FinFlow_transactions_{datetime.datetime.now()}.json"
    logger.info(f"DATA Export successfully for {current_user.username}")
    return StreamingResponse(
        file_like,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@data.post("/import", status_code=status.HTTP_201_CREATED, response_class=JSONResponse)
async def import_data(file: UploadFile = File(...),
                      session=Depends(get_session),
                      current_user=Depends(get_current_user),
                      ):
    if file.size > settings.MAX_FILE_SIZE:
        logger.warning(f"User {current_user.username} tried to upload too large file: {file.size} bytes")
        raise LargeFileSize(f"File is too large. Maximum size allowed is {int(settings.MAX_FILE_SIZE / (1024 * 1024))}MB.")
    contents = await file.read()
    try:
        raw_json = json.loads(contents)
        adapter = TypeAdapter(List[TransactionData])
        valid_data = adapter.validate_python(raw_json)
    except Exception as e:
        logger.warning(f"DATA error import {e}")
        raise BrokenFileError("Broken file")
    count = await TransactionDAO.create_transactions_import(session=session,
                                                            user_id=current_user.id,
                                                            valid_data=valid_data)

    await session.commit()
    logger.info(f"DATA import completed succesfully for {current_user.username}")
    return {"message": f"Data import completed successfully: {count}"}



#id, name, description, price, category_id, created_at, currency, transaction_type

