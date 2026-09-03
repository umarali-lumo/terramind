"""Yield forecast endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_farm_or_404, get_field_or_404
from app.core.database import get_db
from app.db.models import Farm, Field
from app.services.intelligence.bundle import build_field_bundle
from app.services.weather import weather_service

router = APIRouter(prefix="/yield", tags=["yield"])


@router.get("/farms/{farm_id}")
async def farm_yield(
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """Yield forecasts for every field plus farm totals."""
    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )

    forecasts = []
    total_tons = 0.0
    total_area = 0.0
    for field in farm.fields:
        bundle = build_field_bundle(db, farm, field, field.crop, forecast)
        yf = bundle["yield_forecast"]
        if "error" in yf:
            continue
        forecasts.append(yf)
        total_tons += yf["total_expected_tons"]
        total_area += field.area_hectares

    return {
        "farm_id": farm.id,
        "fields": forecasts,
        "total_expected_tons": round(total_tons, 1),
        "total_area_hectares": round(total_area, 1),
        "average_yield_t_per_ha": round(total_tons / total_area, 2) if total_area else None,
    }


@router.get("/fields/{field_id}")
async def field_yield(
    field: Field = Depends(get_field_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """Detailed yield forecast for one field."""
    forecast = await weather_service.get_forecast(
        field.latitude, field.longitude, farm_id=field.farm_id
    )
    bundle = build_field_bundle(db, field.farm, field, field.crop, forecast)
    return bundle["yield_forecast"]
