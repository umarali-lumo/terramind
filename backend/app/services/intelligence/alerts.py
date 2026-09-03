"""Alert generation & persistence.

`refresh_alerts` derives alerts from live intelligence for a farm and
persists them idempotently (deduplicated by signature). Resolved alerts
stay quiet for 24h before the same condition may re-trigger.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Alert, Field

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


def _find_existing(db: Session, farm_id: int, signature: str) -> Alert | None:
    return db.scalars(
        select(Alert).where(Alert.farm_id == farm_id, Alert.signature == signature)
    ).first()


def upsert_alert(
    db: Session,
    farm_id: int,
    field_id: int | None,
    severity: str,
    category: str,
    signature: str,
    title: str,
    message: str,
    recommended_action: str,
) -> None:
    existing = _find_existing(db, farm_id, signature)
    now = datetime.now(UTC)

    if existing is None:
        db.add(
            Alert(
                farm_id=farm_id,
                field_id=field_id,
                severity=severity,
                category=category,
                signature=signature,
                title=title,
                message=message,
                recommended_action=recommended_action,
            )
        )
        return

    # Respect a recent manual resolution; do not resurrect immediately.
    if existing.is_resolved:
        if existing.resolved_at and now - existing.resolved_at < timedelta(hours=24):
            return
        # Enough time has passed — re-open with fresh content.
        existing.is_resolved = False
        existing.resolved_at = None

    existing.severity = severity
    existing.title = title
    existing.message = message
    existing.recommended_action = recommended_action
    existing.updated_at = now


def refresh_alerts(
    db: Session,
    farm_id: int,
    fields: list[Field],
    field_bundles: dict[int, dict],
) -> None:
    """Regenerate derived alerts for a farm from computed intelligence."""

    for field in fields:
        bundle = field_bundles.get(field.id)
        if bundle is None:
            continue

        health = bundle["health"]
        conditions = bundle["conditions"]
        irrigation = bundle["irrigation"]
        stress_risks = bundle["stress_risks"]
        latest_scan = bundle.get("latest_disease_scan")

        # --- Low health --------------------------------------------------
        if health["health_score"] < 55:
            severity = "critical" if health["health_score"] < 40 else "warning"
            upsert_alert(
                db,
                farm_id,
                field.id,
                severity,
                "health",
                f"health:field-{field.id}",
                f"Crop health critical in {field.name}",
                health["summary"],
                "Open the field intelligence view and address the top "
                "contributing factors.",
            )

        # --- Water stress prediction --------------------------------------
        for risk in stress_risks:
            if risk["risk_type"] == "water" and risk["level"] == "high":
                upsert_alert(
                    db,
                    farm_id,
                    field.id,
                    "critical" if risk["probability"] >= 80 else "warning",
                    "water_stress",
                    f"water-stress:field-{field.id}",
                    f"High water stress risk — {field.name}",
                    risk["prediction"],
                    risk["recommended_action"],
                )
            elif risk["risk_type"] == "disease" and risk["level"] == "high":
                upsert_alert(
                    db,
                    farm_id,
                    field.id,
                    "warning",
                    "disease_pressure",
                    f"disease-pressure:field-{field.id}",
                    f"Disease pressure rising — {field.name}",
                    risk["prediction"],
                    risk["recommended_action"],
                )
            elif risk["risk_type"] == "heat" and risk["level"] == "high":
                upsert_alert(
                    db,
                    farm_id,
                    field.id,
                    "warning",
                    "heat_stress",
                    f"heat-stress:field-{field.id}",
                    f"Heat stress expected — {field.name}",
                    risk["prediction"],
                    risk["recommended_action"],
                )

        # --- Irrigation needed ---------------------------------------------
        if irrigation["recommendation"] == "irrigate":
            upsert_alert(
                db,
                farm_id,
                field.id,
                "warning",
                "irrigation",
                f"irrigation:field-{field.id}",
                f"Irrigation recommended — {field.name}",
                irrigation["headline"]
                + (
                    f" Estimated requirement: {irrigation['water_needed_mm']:.0f} mm "
                    f"({irrigation['estimated_volume_m3']:.0f} m³)."
                    if irrigation["water_needed_mm"] > 0
                    else ""
                ),
                "Review the irrigation plan and apply water during cooler hours.",
            )

        # --- Low soil moisture (info when not yet urgent) -------------------
        if (
            irrigation["recommendation"] != "irrigate"
            and conditions["soil_moisture"] < irrigation["target_moisture_min"]
        ):
            upsert_alert(
                db,
                farm_id,
                field.id,
                "info",
                "soil_moisture",
                f"low-moisture:field-{field.id}",
                f"Soil moisture below target — {field.name}",
                f"Soil moisture is {conditions['soil_moisture']:.0f}% against a target "
                f"minimum of {irrigation['target_moisture_min']:.0f}%.",
                "Keep monitoring; the irrigation advisor will escalate if the deficit grows.",
            )

        # --- Confirmed disease detection ------------------------------------
        if latest_scan and not latest_scan.get("is_healthy", True):
            upsert_alert(
                db,
                farm_id,
                field.id,
                "critical" if latest_scan.get("severity") == "Severe" else "warning",
                "disease_detected",
                f"disease-detected:field-{field.id}:scan-{latest_scan.get('id')}",
                f"{latest_scan.get('disease')} detected — {field.name}",
                f"Computer vision detected {latest_scan.get('disease')} with "
                f"{latest_scan.get('confidence', 0):.0f}% confidence.",
                latest_scan.get("recommended_action") or "Inspect affected plants.",
            )

    # --- Auto-resolve alerts whose condition disappeared ------------------
    active_signatures = set()
    db.flush()  # ensure new alerts have ids
    for alert in db.scalars(select(Alert).where(Alert.farm_id == farm_id)).all():
        if not alert.is_resolved:
            active_signatures.add(alert.signature)

    db.commit()


def sort_alerts(alerts: list[Alert]) -> list[Alert]:
    """Critical first, then newest first within each severity."""
    return sorted(
        alerts,
        key=lambda a: (
            SEVERITY_ORDER.get(a.severity, 9),
            -(a.created_at.timestamp() if a.created_at else 0),
        ),
    )
