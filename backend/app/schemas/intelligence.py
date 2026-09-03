"""Irrigation and yield schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class IrrigationAdvice(BaseModel):
    field_id: int
    field_name: str
    recommendation: str  # irrigate | monitor | hold
    headline: str
    urgency_hours: int | None = None
    soil_moisture: float
    target_moisture_min: float
    target_moisture_max: float
    deficit_mm: float
    water_needed_mm: float
    estimated_volume_m3: float
    forecast_rain_mm: float
    reasons: list[str]
    status: str


class YieldFactor(BaseModel):
    name: str
    impact: str  # positive | negative | neutral
    note: str


class YieldForecast(BaseModel):
    field_id: int
    field_name: int | str
    crop_name: str
    expected_yield_t_per_ha: float
    min_yield_t_per_ha: float
    max_yield_t_per_ha: float
    total_expected_tons: float
    area_hectares: float
    previous_yield_t_per_ha: float | None = None
    trend_percent: float | None = None
    expected_harvest_date: date | None = None
    days_to_harvest: int | None = None
    confidence: int
    factors: list[YieldFactor]
