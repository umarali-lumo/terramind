"""Field intelligence assembler.

Connects every intelligence module for a field:
weather → conditions → health / stress / irrigation / yield → alerts.
This is the seam that keeps TerraMind a connected system rather than
disconnected pages.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Crop, DiseaseScan, Field, Farm, WeatherSnapshot
from app.services.intelligence.health import (
    compute_health,
    get_health_trend,
    health_change_7d,
)
from app.services.intelligence.irrigation import irrigation_advice
from app.services.intelligence.stress import predict_stress
from app.services.intelligence.yield_forecast import forecast_yield
from app.services.telemetry import get_conditions


def build_field_bundle(
    db: Session,
    farm: Farm,
    field: Field,
    crop: Crop | None,
    forecast,
) -> dict:
    """Assemble the full intelligence bundle for one field.

    The caller passes a shared `WeatherForecast` (one fetch per farm) so a
    farm with many fields stays cheap.
    """
    current = forecast.current
    conditions = get_conditions(field, crop, current)
    health = compute_health(field, crop, conditions, _latest_scan(db, field))
    trend = get_health_trend(db, field, crop, conditions)
    change_7d = health_change_7d(trend)
    health_dict = health.model_dump()
    health_dict["change_7d"] = change_7d

    stress_risks = [
        risk.model_dump()
        for risk in predict_stress(field, crop, conditions, current, forecast.hourly, forecast.daily)
    ]
    irrigation = irrigation_advice(field, crop, conditions, forecast.hourly)
    yield_forecast = forecast_yield(db, field, crop, health)

    latest = _latest_scan(db, field)

    return {
        "field": field,
        "crop": crop,
        "conditions": conditions.model_dump(),
        "health": health_dict,
        "stress_risks": stress_risks,
        "irrigation": irrigation,
        "yield_forecast": yield_forecast,
        "latest_disease_scan": _scan_dict(latest) if latest else None,
        "health_trend": trend,
        "weather": current.model_dump(),
    }


def _latest_scan(db: Session, field: Field) -> DiseaseScan | None:
    return db.scalars(
        select(DiseaseScan)
        .where(DiseaseScan.field_id == field.id)
        .order_by(DiseaseScan.created_at.desc())
        .limit(1)
    ).first()


def _scan_dict(scan: DiseaseScan) -> dict:
    return {
        "id": scan.id,
        "field_id": scan.field_id,
        "detected_crop": scan.detected_crop,
        "disease": scan.disease,
        "confidence": scan.confidence,
        "severity": scan.severity,
        "disease_risk": scan.disease_risk,
        "is_healthy": scan.is_healthy,
        "recommended_action": scan.recommended_action,
        "created_at": scan.created_at.isoformat(),
    }


def persist_weather_snapshot(db: Session, farm: Farm, current) -> None:  # noqa: ANN001
    """Store the latest observed weather for the farm (train data for future ML)."""
    snapshot = WeatherSnapshot(
        farm_id=farm.id,
        recorded_at=datetime.now(UTC),
        temperature=current.temperature,
        humidity=current.humidity,
        wind_speed=current.wind_speed,
        precipitation_mm=current.precipitation_mm,
        rain_probability=current.rain_probability,
        weather_code=current.weather_code,
        summary=current.summary,
        source=current.source,
    )
    db.add(snapshot)
    db.commit()


def build_farm_bundles(
    db: Session,
    farm: Farm,
    forecast,
) -> dict[int, dict]:
    """Bundles for every field in a farm (single weather fetch shared)."""
    bundles: dict[int, dict] = {}
    for field in farm.fields:
        bundles[field.id] = build_field_bundle(db, farm, field, field.crop, forecast)
    return bundles
