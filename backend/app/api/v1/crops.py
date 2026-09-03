"""Crop catalog endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.db.models import Crop, User
from app.schemas.fields import CropListResponse, CropResponse

router = APIRouter(prefix="/crops", tags=["crops"])


@router.get("", response_model=CropListResponse)
def list_crops(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CropListResponse:
    crops = db.scalars(select(Crop).order_by(Crop.name)).all()
    return CropListResponse(
        crops=[CropResponse.model_validate(crop) for crop in crops]
    )
