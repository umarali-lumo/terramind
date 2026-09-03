"""Farm endpoints, including the overview intelligence dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_farm_or_404
from app.core.database import get_db
from app.core.errors import APIError, bad_request, not_found
from app.db.models import Alert, Farm, User
from app.schemas.farms import (
    FarmCreate,
    FarmDetail,
    FarmListResponse,
    FarmUpdate,
    GeocodeResponse,
    GeocodeResult,
)
from app.services.geo import search_locations
from app.services.intelligence.alerts import refresh_alerts, sort_alerts
from app.services.intelligence.bundle import (
    build_farm_bundles,
    persist_weather_snapshot,
)
from app.services.weather import weather_service

router = APIRouter(prefix="/farms", tags=["farms"])


@router.get("", response_model=FarmListResponse)
def list_farms(user: User = Depends(get_current_user)) -> FarmListResponse:
    farms = []
    for farm in sorted(user.farms, key=lambda f: f.id):
        farms.append(_summary(farm))
    return FarmListResponse(farms=farms)


@router.post("", response_model=FarmDetail, status_code=status.HTTP_201_CREATED)
def create_farm(
    payload: FarmCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FarmDetail:
    farm = Farm(
        user_id=user.id,
        name=payload.name,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_primary=len(user.farms) == 0,
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return _summary(farm)


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode_locations(
    q: str = "",
    user: User = Depends(get_current_user),
) -> GeocodeResponse:
    """Location search for the Add Farm form (Open-Meteo geocoding)."""
    results = await search_locations(q)
    return GeocodeResponse(results=[GeocodeResult(**r) for r in results])


@router.get("/{farm_id}", response_model=FarmDetail)
def get_farm(farm: Farm = Depends(get_farm_or_404)) -> FarmDetail:
    return _summary(farm)


@router.patch("/{farm_id}", response_model=FarmDetail)
def update_farm(
    payload: FarmUpdate,
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> FarmDetail:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise bad_request("No fields to update.")
    for key, value in data.items():
        setattr(farm, key, value)
    db.commit()
    db.refresh(farm)
    return _summary(farm)


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> None:
    db.delete(farm)
    db.commit()


@router.get("/{farm_id}/overview")
async def farm_overview(
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> dict:
    """The digital-twin dashboard payload: everything in one call."""
    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )
    persist_weather_snapshot(db, farm, forecast.current)

    bundles = build_farm_bundles(db, farm, forecast)
    refresh_alerts(db, farm.id, farm.fields, bundles)

    field_cards = []
    for field in farm.fields:
        bundle = bundles[field.id]
        field_cards.append(
            {
                "id": field.id,
                "name": field.name,
                "crop": field.crop.name if field.crop else None,
                "variety": field.variety,
                "growth_stage": bundle["conditions"]["growth_stage"],
                "area_hectares": field.area_hectares,
                "latitude": field.latitude,
                "longitude": field.longitude,
                "boundary": field.boundary,
                "health_score": bundle["health"]["health_score"],
                "health_status": bundle["health"]["health_status"],
                "health_change_7d": bundle["health"].get("change_7d"),
                "soil_moisture": bundle["conditions"]["soil_moisture"],
                "disease_risk": bundle["conditions"]["disease_risk"],
                "water_stress": bundle["conditions"]["water_stress"],
                "irrigation_recommendation": bundle["irrigation"]["recommendation"],
                "risk_level": _max_risk(bundle),
            }
        )

    alerts = sort_alerts(
        db.scalars(select(Alert).where(Alert.farm_id == farm.id)).all()
    )
    open_alerts = [a for a in alerts if not a.is_resolved]

    scores = [c["health_score"] for c in field_cards]
    return {
        "farm": {
            "id": farm.id,
            "name": farm.name,
            "location_name": farm.location_name,
            "latitude": farm.latitude,
            "longitude": farm.longitude,
        },
        "weather": forecast.model_dump(),
        "fields": field_cards,
        "farm_health": {
            "average_score": round(sum(scores) / len(scores), 0) if scores else None,
            "field_count": len(field_cards),
            "total_area_hectares": round(sum(f.area_hectares for f in farm.fields), 1),
        },
        "alerts": {
            "open_count": len(open_alerts),
            "critical_count": sum(1 for a in open_alerts if a.severity == "critical"),
            "latest": [
                {
                    "id": a.id,
                    "severity": a.severity,
                    "category": a.category,
                    "title": a.title,
                    "message": a.message,
                    "recommended_action": a.recommended_action,
                    "field_id": a.field_id,
                    "created_at": a.created_at.isoformat(),
                }
                for a in open_alerts[:6]
            ],
        },
        "top_recommendation": _top_recommendation(bundles, farm),
        "data_sources": {
            "weather": forecast.current.source,
            "telemetry": "simulated",
        },
    }


def _summary(farm: Farm) -> FarmDetail:
    return FarmDetail(
        id=farm.id,
        name=farm.name,
        location_name=farm.location_name,
        latitude=farm.latitude,
        longitude=farm.longitude,
        is_primary=farm.is_primary,
        created_at=farm.created_at,
        updated_at=farm.updated_at,
        field_count=len(farm.fields),
        total_area_hectares=round(sum(f.area_hectares for f in farm.fields), 1),
    )


def _max_risk(bundle: dict) -> str:
    levels = [r["level"] for r in bundle["stress_risks"]]
    if "high" in levels:
        return "high"
    if "moderate" in levels:
        return "moderate"
    return "low"


def _top_recommendation(bundles: dict[int, dict], farm: Farm) -> dict | None:
    """Pick the single most urgent action across the farm."""
    candidates: list[tuple[int, str, str, str]] = []  # (priority, field, title, action)

    for field in farm.fields:
        bundle = bundles.get(field.id)
        if bundle is None:
            continue
        irr = bundle["irrigation"]
        if irr["recommendation"] == "irrigate":
            candidates.append(
                (
                    1,
                    field.name,
                    f"Irrigate {field.name} within {irr['urgency_hours']}h",
                    f"Soil moisture {irr['soil_moisture']:.0f}% is below target — apply "
                    f"≈{irr['water_needed_mm']:.0f} mm ({irr['estimated_volume_m3']:.0f} m³).",
                )
            )
        for risk in bundle["stress_risks"]:
            if risk["level"] == "high":
                candidates.append(
                    (
                        2,
                        field.name,
                        f"{risk['risk_type'].title()} stress risk — {field.name}",
                        risk["recommended_action"],
                    )
                )
        scan = bundle.get("latest_disease_scan")
        if scan and not scan["is_healthy"] and scan["severity"] in ("Moderate", "Severe"):
            candidates.append(
                (
                    0,
                    field.name,
                    f"{scan['disease']} detected — {field.name}",
                    scan["recommended_action"],
                )
            )

    if not candidates:
        return None
    candidates.sort(key=lambda c: c[0])
    _, field_name, title, action = candidates[0]
    return {"field_name": field_name, "title": title, "action": action}
