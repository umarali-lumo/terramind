"""Crop health endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_farm_or_404, get_field_or_404
from app.core.database import get_db
from app.db.models import Farm, Field
from app.services.intelligence.bundle import build_field_bundle
from app.services.weather import weather_service

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/fields/{field_id}")
async def field_health(
    field: Field = Depends(get_field_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """Health score + contributing factors + trend for one field."""
    forecast = await weather_service.get_forecast(
        field.latitude, field.longitude, farm_id=field.farm_id
    )
    bundle = build_field_bundle(db, field.farm, field, field.crop, forecast)

    health = bundle["health"]
    health["trend"] = _trend(bundle)
    return health


@router.get("/farms/{farm_id}")
async def farm_health(
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """Health assessment for every field in a farm."""
    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )
    assessments = []
    for field in farm.fields:
        bundle = build_field_bundle(db, farm, field, field.crop, forecast)
        assessments.append(bundle["health"])

    scores = [a["health_score"] for a in assessments] or [0]
    return {
        "farm_id": farm.id,
        "average_score": round(sum(scores) / len(scores), 0),
        "fields": assessments,
    }


def _trend(bundle: dict) -> list[dict]:
    return [
        {
            "recorded_at": p["recorded_at"].isoformat(),
            "health_score": p["health_score"],
            "soil_moisture": p["soil_moisture"],
            "air_temperature": p["air_temperature"],
            "humidity": p["humidity"],
        }
        for p in bundle["health_trend"]
    ]
