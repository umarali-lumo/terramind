"""Weather intelligence endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_farm_or_404, get_field_or_404
from app.db.models import Farm, Field
from app.services.weather import weather_service

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/farms/{farm_id}")
async def farm_weather(farm: Farm = Depends(get_farm_or_404)) -> dict:
    """Current conditions + 7-day forecast + agri notes for a farm."""
    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )
    return forecast.model_dump()


@router.get("/fields/{field_id}")
async def field_weather(field: Field = Depends(get_field_or_404)) -> dict:
    """Weather at a specific field centroid."""
    forecast = await weather_service.get_forecast(
        field.latitude, field.longitude, farm_id=field.farm_id
    )
    return forecast.model_dump()
