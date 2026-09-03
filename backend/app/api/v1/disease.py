"""AI crop-disease detection endpoints."""

from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_field_or_404
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import APIError, not_found
from app.db.models import DiseaseScan, Field, User
from app.schemas.disease import (
    DiseaseModelStatus,
    DiseaseScanListResponse,
    DiseaseScanResult,
)
from app.services.disease import disease_classifier
from app.services.disease.knowledge import (
    disease_risk_score,
    recommended_action,
    severity_for,
)

logger = logging.getLogger("terramind.disease")

router = APIRouter(prefix="/disease", tags=["disease"])
settings = get_settings()


@router.get("/model", response_model=DiseaseModelStatus)
def model_status() -> DiseaseModelStatus:
    """Current disease-model status (for UI readiness indicators)."""
    status = disease_classifier.status()
    return DiseaseModelStatus(**status)


@router.post("/scan", response_model=DiseaseScanResult)
async def scan_crop_image(
    file: UploadFile = File(...),
    field_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiseaseScanResult:
    """Upload a crop/leaf image and run AI disease detection."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise APIError(400, "invalid_request", "Please upload an image file.")

    image_bytes = await file.read()
    if len(image_bytes) > settings.max_image_size_bytes:
        raise APIError(413, "payload_too_large", "Image is larger than 10 MB.")

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise APIError(400, "invalid_request", "Invalid image file.") from exc

    predictions = disease_classifier.classify(image)
    best = predictions[0]

    severity = severity_for(best["disease"], best["confidence"])
    action = recommended_action(best["disease"])
    is_healthy = "healthy" in best["disease"].lower()

    # Persist the uploaded image for evidence/history.
    filename = f"{uuid.uuid4().hex}.jpg"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    image.save(upload_dir / filename, format="JPEG", quality=85)

    field = None
    if field_id is not None:
        field = db.get(Field, field_id)
        if field is None:
            raise not_found("Field", field_id)
        if field.farm.user_id != user.id:
            raise APIError(403, "forbidden", "You do not have access to this field.")

    scan = DiseaseScan(
        user_id=user.id,
        field_id=field.id if field else None,
        image_filename=filename,
        detected_crop=best["crop"],
        disease=best["disease"],
        confidence=best["confidence"],
        severity=severity,
        disease_risk=disease_risk_score(best["disease"], best["confidence"]),
        is_healthy=is_healthy,
        recommended_action="" if is_healthy else action,
        top_predictions=predictions,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    return DiseaseScanResult.from_scan(
        scan, field.name if field else None
    )


@router.get("/scans", response_model=DiseaseScanListResponse)
def list_scans(
    field_id: int | None = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiseaseScanListResponse:
    """Scan history (optionally filtered by field)."""
    query = (
        select(DiseaseScan)
        .where(DiseaseScan.user_id == user.id)
        .order_by(DiseaseScan.created_at.desc())
        .limit(min(limit, 200))
    )
    if field_id is not None:
        query = query.where(DiseaseScan.field_id == field_id)

    scans = db.scalars(query).all()
    field_names = {}
    for scan in scans:
        if scan.field_id and scan.field_id not in field_names:
            field = db.get(Field, scan.field_id)
            field_names[scan.field_id] = field.name if field else None

    return DiseaseScanListResponse(
        scans=[
            DiseaseScanResult.from_scan(s, field_names.get(s.field_id)) for s in scans
        ]
    )


@router.get("/scans/{scan_id}", response_model=DiseaseScanResult)
def get_scan(
    scan_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiseaseScanResult:
    scan = db.get(DiseaseScan, scan_id)
    if scan is None or scan.user_id != user.id:
        raise not_found("Scan", scan_id)
    field = db.get(Field, scan.field_id) if scan.field_id else None
    return DiseaseScanResult.from_scan(scan, field.name if field else None)


@router.get("/scans/{scan_id}/image")
def get_scan_image(
    scan_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    scan = db.get(DiseaseScan, scan_id)
    if scan is None or scan.user_id != user.id:
        raise not_found("Scan", scan_id)

    path = Path(settings.upload_dir) / scan.image_filename
    if not path.exists():
        raise not_found("Scan image")

    return FileResponse(path, media_type="image/jpeg")
