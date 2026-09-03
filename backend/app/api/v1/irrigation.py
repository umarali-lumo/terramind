"""Irrigation intelligence endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_farm_or_404, get_field_or_404
from app.core.database import get_db
from app.db.models import Farm, Field
from app.services.intelligence.bundle import build_field_bundle
from app.services.weather import weather_service

router = APIRouter(prefix="/irrigation", tags=["irrigation"])


@router.get("/farms/{farm_id}")
async def farm_irrigation(
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """Irrigation recommendations for every field in a farm."""
    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )

    recommendations = []
    total_volume = 0.0
    for field in farm.fields:
        bundle = build_field_bundle(db, farm, field, field.crop, forecast)
        recommendations.append(bundle["irrigation"])
        total_volume += bundle["irrigation"]["estimated_volume_m3"]

    return {
        "farm_id": farm.id,
        "recommendations": sorted(
            recommendations,
            key=lambda r: {"irrigate": 0, "monitor": 1, "hold": 2}[r["recommendation"]],
        ),
        "total_estimated_volume_m3": round(total_volume, 1),
        "summary": _summary(recommendations),
    }


@router.get("/fields/{field_id}")
async def field_irrigation(
    field: Field = Depends(get_field_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """Detailed irrigation recommendation for one field."""
    forecast = await weather_service.get_forecast(
        field.latitude, field.longitude, farm_id=field.farm_id
    )
    bundle = build_field_bundle(db, field.farm, field, field.crop, forecast)
    result = bundle["irrigation"]
    result["forecast_hourly"] = [
        {
            "time": h.time.isoformat(),
            "temperature": h.temperature,
            "precipitation_mm": h.precipitation_mm,
            "rain_probability": h.rain_probability,
        }
        for h in forecast.hourly[:48]
    ]
    return result


def _summary(recommendations: list[dict]) -> str:
    irrigate = [r for r in recommendations if r["recommendation"] == "irrigate"]
    if irrigate:
        names = ", ".join(r["field_name"] for r in irrigate)
        return f"Irrigation recommended for: {names}."
    monitor = [r for r in recommendations if r["recommendation"] == "monitor"]
    if monitor:
        names = ", ".join(r["field_name"] for r in monitor)
        return f"Monitor closely: {names}."
    return "All fields are within their target moisture bands."
