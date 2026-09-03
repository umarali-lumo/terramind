"""API v1 router aggregation."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    alerts,
    auth,
    copilot,
    crops,
    disease,
    farms,
    fields,
    health,
    irrigation,
    iot,
    weather,
    yield_forecast,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(farms.router)
api_router.include_router(fields.router)
api_router.include_router(crops.router)
api_router.include_router(weather.router)
api_router.include_router(health.router)
api_router.include_router(disease.router)
api_router.include_router(irrigation.router)
api_router.include_router(yield_forecast.router)
api_router.include_router(alerts.router)
api_router.include_router(copilot.router)
api_router.include_router(iot.router)
