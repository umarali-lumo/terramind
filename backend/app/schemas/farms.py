"""Farm schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field, computed_field

from app.schemas.common import TimestampedModel


class FarmCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    location_name: str = Field(default="", max_length=160)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class FarmUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    location_name: str | None = Field(default=None, max_length=160)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class FarmSummary(TimestampedModel):
    id: int
    name: str
    location_name: str
    latitude: float
    longitude: float
    is_primary: bool
    field_count: int = 0
    total_area_hectares: float = 0.0
    average_health: float | None = None


class FarmDetail(FarmSummary):
    pass


class FarmListResponse(BaseModel):
    farms: list[FarmSummary]
