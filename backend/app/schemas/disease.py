"""Disease detection schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DiseasePrediction(BaseModel):
    label: str
    crop: str
    disease: str
    confidence: float


class DiseaseScanResult(BaseModel):
    id: int
    field_id: int | None = None
    field_name: str | None = None
    image_url: str | None = None
    detected_crop: str
    disease: str
    confidence: float
    severity: str
    disease_risk: int
    is_healthy: bool
    recommended_action: str
    top_predictions: list[DiseasePrediction]
    created_at: datetime

    @classmethod
    def from_scan(cls, scan, field_name: str | None = None) -> DiseaseScanResult:
        return cls(
            id=scan.id,
            field_id=scan.field_id,
            field_name=field_name,
            image_url=f"/api/v1/disease/scans/{scan.id}/image"
            if scan.image_filename
            else None,
            detected_crop=scan.detected_crop,
            disease=scan.disease,
            confidence=scan.confidence,
            severity=scan.severity,
            disease_risk=scan.disease_risk,
            is_healthy=scan.is_healthy,
            recommended_action=scan.recommended_action,
            top_predictions=[DiseasePrediction(**p) for p in (scan.top_predictions or [])],
            created_at=scan.created_at,
        )


class DiseaseScanListResponse(BaseModel):
    scans: list[DiseaseScanResult]


class DiseaseModelStatus(BaseModel):
    enabled: bool
    loaded: bool
    model_name: str
    device: str
    error: str | None = None
