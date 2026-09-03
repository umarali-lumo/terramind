"""Field endpoints: CRUD + full field intelligence bundle."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_farm_or_404, get_field_or_404
from app.core.database import get_db
from app.core.errors import bad_request, not_found
from app.db.models import Crop, CropCycle, Farm, Field, User
from app.schemas.fields import (
    FieldCreate,
    FieldDetail,
    FieldListResponse,
    FieldUpdate,
)
from app.services.geo import ring_area_hectares, ring_centroid
from app.services.intelligence.bundle import build_field_bundle
from app.services.telemetry import growth_stage_for
from app.services.weather import weather_service

router = APIRouter(prefix="/fields", tags=["fields"])


@router.get("", response_model=FieldListResponse)
async def list_fields(
    farm_id: int,
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> FieldListResponse:
    """List fields of a farm with live health scores."""
    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )
    fields = []
    for field in farm.fields:
        bundle = build_field_bundle(db, farm, field, field.crop, forecast)
        fields.append(_summary(field, bundle))
    return FieldListResponse(fields=fields)


@router.post("", response_model=FieldDetail, status_code=status.HTTP_201_CREATED)
def create_field(
    payload: FieldCreate,
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> FieldDetail:
    crop = _resolve_crop(db, payload.crop_id)

    if payload.boundary:
        area = ring_area_hectares(payload.boundary)
        lng, lat = ring_centroid(payload.boundary)
    else:
        area = 0.0
        lat, lng = farm.latitude, farm.longitude

    field = Field(
        farm_id=farm.id,
        crop_id=crop.id if crop else None,
        name=payload.name,
        variety=payload.variety,
        planting_date=payload.planting_date,
        growth_stage="Unknown",
        soil_type=payload.soil_type,
        soil_ph=payload.soil_ph,
        boundary=payload.boundary,
        area_hectares=area,
        latitude=lat,
        longitude=lng,
    )
    if crop is not None:
        stage, _ = growth_stage_for(crop, payload.planting_date)
        field.growth_stage = stage

    db.add(field)
    db.flush()

    if crop is not None and payload.planting_date is not None:
        db.add(
            CropCycle(
                field_id=field.id,
                crop_id=crop.id,
                variety=payload.variety,
                season_label=f"Season {payload.planting_date.year}",
                planting_date=payload.planting_date,
                status="active",
            )
        )

    db.commit()
    db.refresh(field)
    return _detail(field)


@router.get("/{field_id}")
async def get_field_intelligence(
    field: Field = Depends(get_field_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """Full per-field intelligence: conditions, health, stress, irrigation, yield."""
    farm = field.farm
    forecast = await weather_service.get_forecast(
        field.latitude, field.longitude, farm_id=farm.id
    )
    bundle = build_field_bundle(db, farm, field, field.crop, forecast)

    return {
        "field": _detail(field).model_dump(),
        "conditions": bundle["conditions"],
        "weather": bundle["weather"],
        "health": bundle["health"],
        "stress_risks": bundle["stress_risks"],
        "irrigation": bundle["irrigation"],
        "yield_forecast": bundle["yield_forecast"],
        "latest_disease_scan": bundle["latest_disease_scan"],
        "health_trend": [
            {
                "recorded_at": p["recorded_at"].isoformat(),
                "health_score": p["health_score"],
                "soil_moisture": p["soil_moisture"],
                "air_temperature": p["air_temperature"],
                "humidity": p["humidity"],
            }
            for p in bundle["health_trend"]
        ],
    }


@router.patch("/{field_id}", response_model=FieldDetail)
def update_field(
    payload: FieldUpdate,
    field: Field = Depends(get_field_or_404),
    db: Session = Depends(get_db),
) -> FieldDetail:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise bad_request("No fields to update.")

    crop = None
    if "crop_id" in data:
        crop = _resolve_crop(db, data["crop_id"])
        field.crop_id = crop.id if crop else None

    if "boundary" in data:
        boundary = data.pop("boundary")
        field.boundary = boundary
        if boundary:
            field.area_hectares = ring_area_hectares(boundary)
            field.longitude, field.latitude = ring_centroid(boundary)

    for key, value in data.items():
        setattr(field, key, value)

    if crop is not None:
        stage, _ = growth_stage_for(crop, field.planting_date)
        field.growth_stage = stage

    db.commit()
    db.refresh(field)
    return _detail(field)


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(
    field: Field = Depends(get_field_or_404),
    db: Session = Depends(get_db),
) -> None:
    db.delete(field)
    db.commit()


# ----------------------------------------------------------------------
def _resolve_crop(db: Session, crop_id: int | None) -> Crop | None:
    if crop_id is None:
        return None
    crop = db.get(Crop, crop_id)
    if crop is None:
        raise not_found("Crop", crop_id)
    return crop


def _summary(field: Field, bundle: dict) -> FieldDetail:
    health = bundle["health"]
    return FieldDetail(
        id=field.id,
        farm_id=field.farm_id,
        name=field.name,
        variety=field.variety,
        crop=_crop_ref(field.crop),
        planting_date=field.planting_date,
        growth_stage=field.growth_stage,
        soil_type=field.soil_type,
        soil_ph=field.soil_ph,
        area_hectares=field.area_hectares,
        latitude=field.latitude,
        longitude=field.longitude,
        boundary=field.boundary,
        created_at=field.created_at,
        updated_at=field.updated_at,
        health_score=health["health_score"],
        health_status=health["health_status"],
    )


def _detail(field: Field) -> FieldDetail:
    return FieldDetail(
        id=field.id,
        farm_id=field.farm_id,
        name=field.name,
        variety=field.variety,
        crop=_crop_ref(field.crop),
        planting_date=field.planting_date,
        growth_stage=field.growth_stage,
        soil_type=field.soil_type,
        soil_ph=field.soil_ph,
        area_hectares=field.area_hectares,
        latitude=field.latitude,
        longitude=field.longitude,
        boundary=field.boundary,
        created_at=field.created_at,
        updated_at=field.updated_at,
    )


def _crop_ref(crop: Crop | None):
    if crop is None:
        return None
    from app.schemas.fields import CropRef

    return CropRef(
        id=crop.id,
        name=crop.name,
        category=crop.category,
        growth_days=crop.growth_days,
        base_yield_t_per_ha=crop.base_yield_t_per_ha,
    )
