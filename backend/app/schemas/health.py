"""Crop-health and field-intelligence schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.fields import FieldDetail
from app.schemas.weather import CurrentWeather


class HealthFactor(BaseModel):
    name: str
    value: str
    status: str  # good | fair | poor | critical
    impact: float  # score points deducted
    note: str = ""


class HealthTrendPoint(BaseModel):
    recorded_at: datetime
    health_score: float
    soil_moisture: float
    air_temperature: float
    humidity: float


class HealthAssessment(BaseModel):
    field_id: int
    field_name: str
    health_score: float
    health_status: str
    change_7d: float | None = None
    summary: str
    factors: list[HealthFactor]
    conditions: dict[str, Any]
    data_source: str  # simulated | sensor


class FieldConditions(BaseModel):
    soil_moisture: float
    soil_temperature: float
    air_temperature: float
    humidity: float
    disease_risk: float
    water_stress: float
    growth_stage: str
    days_since_planting: int | None = None
    water_demand_mm_per_day: float
    source: str


class StressRisk(BaseModel):
    field_id: int
    field_name: str
    risk_type: str  # water | heat | disease
    level: str  # low | moderate | high | severe
    probability: float
    window_hours: int
    contributing_factors: list[str]
    prediction: str
    recommended_action: str


class FieldIntelligence(BaseModel):
    field: FieldDetail
    conditions: FieldConditions
    weather: CurrentWeather
    health: HealthAssessment
    stress_risks: list[StressRisk]
    irrigation: dict[str, Any]
    yield_forecast: dict[str, Any]
    latest_disease_scan: dict[str, Any] | None = None
    health_trend: list[HealthTrendPoint]
