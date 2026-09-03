"""Yield forecasting engine.

Blend of crop base yield, current health trajectory and growth progress.
Structured so a trained ML model can later replace the estimator while
keeping the same response contract.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Crop, CropCycle, DiseaseScan, Field, HealthMetric
from app.schemas.health import HealthAssessment
from app.services.telemetry import growth_stage_for


def forecast_yield(
    db: Session,
    field: Field,
    crop: Crop | None,
    health: HealthAssessment,
) -> dict:
    if crop is None:
        return {
            "field_id": field.id,
            "field_name": field.name,
            "crop_name": "Unassigned",
            "error": "Assign a crop to generate a yield forecast.",
        }

    stage, days_since = growth_stage_for(crop, field.planting_date)

    # --- Expected harvest date ---
    if field.planting_date is not None:
        harvest = field.planting_date + timedelta(days=crop.growth_days)
        days_to_harvest = (harvest - date.today()).days
    else:
        harvest = None
        days_to_harvest = None

    # --- Health adjustment ---
    # Health score 70+ → full potential; below that, yield scales down.
    health_factor = 0.55 + (health.health_score / 100.0) * 0.45

    # --- Growth-progress confidence ---
    if days_since is None:
        progress_confidence = 40
    elif days_since <= 0:
        progress_confidence = 45
    else:
        progress = min(1.0, days_since / crop.growth_days)
        progress_confidence = int(45 + progress * 40)  # 45% → 85%

    expected = crop.base_yield_t_per_ha * health_factor
    spread = expected * (0.10 + (1 - progress_confidence / 100.0) * 0.18)

    # --- Active disease penalty ---
    latest_scan = db.scalars(
        select(DiseaseScan)
        .where(DiseaseScan.field_id == field.id)
        .order_by(DiseaseScan.created_at.desc())
        .limit(1)
    ).first()
    disease_penalty = 0.0
    if (
        latest_scan is not None
        and not latest_scan.is_healthy
        and (datetime.now(UTC) - latest_scan.created_at).days <= 21
    ):
        disease_penalty = {"Severe": 0.18, "Moderate": 0.10, "Mild": 0.04}.get(
            latest_scan.severity, 0.08
        )
        expected *= 1 - disease_penalty

    expected = round(expected, 2)
    total_tons = round(expected * field.area_hectares, 2)

    # --- Historical comparison (previous completed cycle) ---
    previous_cycle = db.scalars(
        select(CropCycle)
        .where(
            CropCycle.field_id == field.id,
            CropCycle.status == "completed",
            CropCycle.crop_id == crop.id,
        )
        .order_by(CropCycle.harvest_date.desc())
        .limit(1)
    ).first()
    previous_yield = previous_cycle.actual_yield_t_per_ha if previous_cycle else None
    trend_percent = (
        round((expected - previous_yield) / previous_yield * 100, 1)
        if previous_yield
        else None
    )

    # --- Explanations ---
    factors: list[dict] = []
    factors.append(
        {
            "name": "Crop health",
            "impact": "positive" if health.health_score >= 70 else "negative",
            "note": f"Health score {health.health_score:.0f}/100 "
            f"({'+' if health_factor > 1 else ''}{(health_factor - 1) * 100:.0f}% yield factor).",
        }
    )
    factors.append(
        {
            "name": "Growth progress",
            "impact": "neutral",
            "note": f"{stage} stage"
            + (f", {days_since} days since planting." if days_since is not None else "."),
        }
    )
    if disease_penalty > 0:
        factors.append(
            {
                "name": f"Active disease ({latest_scan.disease})",
                "impact": "negative",
                "note": f"−{disease_penalty * 100:.0f}% penalty from recent detection.",
            }
        )
    if previous_yield is not None:
        factors.append(
            {
                "name": "Previous season",
                "impact": "positive" if (trend_percent or 0) >= 0 else "negative",
                "note": f"Last cycle yielded {previous_yield:.1f} t/ha.",
            }
        )

    return {
        "field_id": field.id,
        "field_name": field.name,
        "crop_name": crop.name,
        "expected_yield_t_per_ha": expected,
        "min_yield_t_per_ha": round(max(0.0, expected - spread), 2),
        "max_yield_t_per_ha": round(expected + spread, 2),
        "total_expected_tons": total_tons,
        "area_hectares": field.area_hectares,
        "previous_yield_t_per_ha": previous_yield,
        "trend_percent": trend_percent,
        "expected_harvest_date": harvest.isoformat() if harvest else None,
        "days_to_harvest": days_to_harvest,
        "confidence": progress_confidence,
        "factors": factors,
    }


def recent_health_scores(db: Session, field_id: int, days: int = 14) -> list[float]:
    since = datetime.now(UTC) - timedelta(days=days)
    metrics = db.scalars(
        select(HealthMetric)
        .where(HealthMetric.field_id == field_id, HealthMetric.recorded_at >= since)
        .order_by(HealthMetric.recorded_at.asc())
    ).all()
    return [m.health_score for m in metrics]
