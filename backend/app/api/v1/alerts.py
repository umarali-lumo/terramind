"""Alerts center endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_farm_or_404
from app.core.database import get_db
from app.core.errors import APIError, not_found
from app.db.models import Alert, Farm, User
from app.schemas.alerts import AlertListResponse, AlertResponse, AlertUpdate
from app.services.intelligence.alerts import refresh_alerts, sort_alerts
from app.services.intelligence.bundle import build_farm_bundles
from app.services.weather import weather_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    farm_id: int,
    severity: str | None = None,
    status_filter: str | None = None,
    category: str | None = None,
    farm: Farm = Depends(get_farm_or_404),
    db: Session = Depends(get_db),
) -> AlertListResponse:
    """Farm alerts with filters. Also refreshes derived alerts on read."""
    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )
    bundles = build_farm_bundles(db, farm, forecast)
    refresh_alerts(db, farm.id, farm.fields, bundles)

    alerts = db.scalars(select(Alert).where(Alert.farm_id == farm.id)).all()

    if severity:
        alerts = [a for a in alerts if a.severity == severity]
    if category:
        alerts = [a for a in alerts if a.category == category]
    if status_filter in ("open", "resolved"):
        alerts = [a for a in alerts if a.is_resolved == (status_filter == "resolved")]

    alerts = sort_alerts(list(alerts))

    field_names = {f.id: f.name for f in farm.fields}
    counts = {
        "critical": sum(1 for a in alerts if a.severity == "critical" and not a.is_resolved),
        "warning": sum(1 for a in alerts if a.severity == "warning" and not a.is_resolved),
        "info": sum(1 for a in alerts if a.severity == "info" and not a.is_resolved),
        "resolved": sum(1 for a in alerts if a.is_resolved),
        "total": len(alerts),
    }
    return AlertListResponse(
        alerts=[
            AlertResponse.from_alert(a, field_names.get(a.field_id)) for a in alerts
        ],
        counts=counts,
    )


@router.patch("/{alert_id}", response_model=AlertResponse)
def update_alert(
    alert_id: int,
    payload: AlertUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise not_found("Alert", alert_id)
    if alert.farm.user_id != user.id:
        raise APIError(403, "forbidden", "You do not have access to this alert.")

    alert.is_resolved = payload.is_resolved
    alert.resolved_at = datetime.now(UTC) if payload.is_resolved else None
    db.commit()
    db.refresh(alert)

    field_name = alert.field.name if alert.field else None
    return AlertResponse.from_alert(alert, field_name)
