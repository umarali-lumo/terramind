"""Field & crop schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import TimestampedModel

# GeoJSON rings are [[lng, lat], ...]; validate plausibility here.
Ring = list[list[float]]


def _validate_ring(ring: Ring) -> Ring:
    if len(ring) < 3:
        raise ValueError("boundary must contain at least 3 points")
    for point in ring:
        if len(point) != 2:
            raise ValueError("each boundary point must be [longitude, latitude]")
        lng, lat = point
        if not (-180 <= lng <= 180) or not (-90 <= lat <= 90):
            raise ValueError("boundary coordinates out of range")
    return ring


class FieldCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    crop_id: int | None = None
    variety: str = Field(default="", max_length=120)
    planting_date: date | None = None
    soil_type: str = Field(default="Loam", max_length=60)
    soil_ph: float = Field(default=7.0, ge=0, le=14)
    boundary: Ring | None = None

    @model_validator(mode="after")
    def validate_boundary(self) -> FieldCreate:
        if self.boundary is not None:
            _validate_ring(self.boundary)
        return self


class FieldUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    crop_id: int | None = None
    variety: str | None = Field(default=None, max_length=120)
    planting_date: date | None = None
    soil_type: str | None = Field(default=None, max_length=60)
    soil_ph: float | None = Field(default=None, ge=0, le=14)
    boundary: Ring | None = None

    @model_validator(mode="after")
    def validate_boundary(self) -> FieldUpdate:
        if self.boundary is not None:
            _validate_ring(self.boundary)
        return self


class CropRef(BaseModel):
    id: int
    name: str
    category: str
    growth_days: int
    base_yield_t_per_ha: float


class FieldSummary(TimestampedModel):
    id: int
    farm_id: int
    name: str
    variety: str
    crop: CropRef | None = None
    planting_date: date | None
    growth_stage: str
    soil_type: str
    soil_ph: float
    area_hectares: float
    latitude: float
    longitude: float
    health_score: float | None = None
    health_status: str | None = None


class FieldDetail(FieldSummary):
    boundary: Ring | None = None


class FieldListResponse(BaseModel):
    fields: list[FieldSummary]


class CropResponse(TimestampedModel):
    id: int
    name: str
    category: str
    growth_days: int
    base_yield_t_per_ha: float
    optimal_moisture_min: float
    optimal_moisture_max: float
    optimal_temp_min: float
    optimal_temp_max: float
    peak_water_demand_mm: float


class CropListResponse(BaseModel):
    crops: list[CropResponse]
