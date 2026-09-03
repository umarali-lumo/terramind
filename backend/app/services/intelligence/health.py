"""Crop health scoring engine.

Computes a 0–100 health score with explainable contributing factors.
Future ML models can replace this by implementing the same contract.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Crop, DiseaseScan, Field, HealthMetric
from app.schemas.health import FieldConditions, HealthAssessment, HealthFactor
from app.services.telemetry import get_conditions, generate_history


def health_status(score: float) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 55:
        return "Fair"
    if score >= 40:
        return "Poor"
    return "Critical"


def compute_health(
    field: Field,
    crop: Crop | None,
    conditions: FieldConditions,
    latest_scan: DiseaseScan | None = None,
) -> HealthAssessment:
    factors: list[HealthFactor] = []
    score = 100.0

    # --- Soil moisture -------------------------------------------------
    if crop is not None:
        lo, hi = crop.optimal_moisture_min, crop.optimal_moisture_max
    else:
        lo, hi = 28.0, 42.0
    moisture = conditions.soil_moisture
    if moisture < lo:
        deviation = (lo - moisture) / max(lo, 1)
        penalty = min(30.0, deviation * 55)
        status = "critical" if penalty > 20 else "poor"
        factors.append(
            HealthFactor(
                name="Soil moisture",
                value=f"{moisture:.0f}% (target {lo:.0f}–{hi:.0f}%)",
                status=status,
                impact=round(penalty, 1),
                note="Below the optimal band for this crop.",
            )
        )
        score -= penalty
    elif moisture > hi + 8:
        penalty = min(18.0, (moisture - hi) * 1.1)
        factors.append(
            HealthFactor(
                name="Soil moisture",
                value=f"{moisture:.0f}% (target {lo:.0f}–{hi:.0f}%)",
                status="fair",
                impact=round(penalty, 1),
                note="Above the optimal band — possible waterlogging.",
            )
        )
        score -= penalty
    else:
        factors.append(
            HealthFactor(
                name="Soil moisture",
                value=f"{moisture:.0f}% (target {lo:.0f}–{hi:.0f}%)",
                status="good",
                impact=0.0,
            )
        )

    # --- Temperature ---------------------------------------------------
    if crop is not None:
        t_lo, t_hi = crop.optimal_temp_min, crop.optimal_temp_max
    else:
        t_lo, t_hi = 15.0, 35.0
    temp = conditions.air_temperature
    if temp > t_hi:
        penalty = min(20.0, (temp - t_hi) * 2.2)
        status = "critical" if penalty > 14 else "poor"
        factors.append(
            HealthFactor(
                name="Temperature",
                value=f"{temp:.0f}°C (optimal ≤ {t_hi:.0f}°C)",
                status=status,
                impact=round(penalty, 1),
                note="Heat stress above the crop comfort band.",
            )
        )
        score -= penalty
    elif temp < t_lo:
        penalty = min(16.0, (t_lo - temp) * 1.6)
        factors.append(
            HealthFactor(
                name="Temperature",
                value=f"{temp:.0f}°C (optimal ≥ {t_lo:.0f}°C)",
                status="poor" if penalty > 8 else "fair",
                impact=round(penalty, 1),
                note="Cold stress below the crop comfort band.",
            )
        )
        score -= penalty
    else:
        factors.append(
            HealthFactor(
                name="Temperature",
                value=f"{temp:.0f}°C (optimal {t_lo:.0f}–{t_hi:.0f}°C)",
                status="good",
                impact=0.0,
            )
        )

    # --- Disease pressure ----------------------------------------------
    disease_risk = conditions.disease_risk
    if disease_risk >= 70:
        penalty = min(18.0, (disease_risk - 60) * 0.5)
        factors.append(
            HealthFactor(
                name="Disease pressure",
                value=f"{disease_risk:.0f}/100",
                status="critical" if disease_risk >= 85 else "poor",
                impact=round(penalty, 1),
                note="Warm, humid conditions favour pathogen development.",
            )
        )
        score -= penalty
    elif disease_risk >= 45:
        penalty = (disease_risk - 40) * 0.25
        factors.append(
            HealthFactor(
                name="Disease pressure",
                value=f"{disease_risk:.0f}/100",
                status="fair",
                impact=round(penalty, 1),
                note="Moderate canopy-disease pressure.",
            )
        )
        score -= penalty
    else:
        factors.append(
            HealthFactor(
                name="Disease pressure",
                value=f"{disease_risk:.0f}/100",
                status="good",
                impact=0.0,
            )
        )

    # --- Confirmed disease scan (last 14 days) --------------------------
    now = datetime.now(UTC)
    if (
        latest_scan is not None
        and not latest_scan.is_healthy
        and (now - latest_scan.created_at) < timedelta(days=14)
    ):
        severity_penalty = {"Severe": 25, "Moderate": 16, "Mild": 8}.get(
            latest_scan.severity, 12
        )
        confidence_factor = max(0.4, latest_scan.confidence / 100.0)
        penalty = severity_penalty * confidence_factor
        factors.append(
            HealthFactor(
                name=f"Detected: {latest_scan.disease}",
                value=f"{latest_scan.confidence:.0f}% confidence · {latest_scan.severity}",
                status="critical" if penalty > 18 else "poor",
                impact=round(penalty, 1),
                note=f"Confirmed by scan on {latest_scan.created_at:%b %d}.",
            )
        )
        score -= penalty
    else:
        factors.append(
            HealthFactor(
                name="Crop scan",
                value="No active disease detected" if latest_scan else "No scans yet",
                status="good",
                impact=0.0,
            )
        )

    # --- Growth stage fit ----------------------------------------------
    if conditions.growth_stage in ("Flowering", "Fruiting") and conditions.water_stress >= 55:
        penalty = min(12.0, conditions.water_stress * 0.14)
        factors.append(
            HealthFactor(
                name=f"Growth stage ({conditions.growth_stage})",
                value=f"Water stress {conditions.water_stress:.0f}/100",
                status="poor",
                impact=round(penalty, 1),
                note="Crop is in a high-sensitivity stage under water stress.",
            )
        )
        score -= penalty
    else:
        factors.append(
            HealthFactor(
                name="Growth stage",
                value=conditions.growth_stage,
                status="good",
                impact=0.0,
            )
        )

    score = round(max(5.0, min(100.0, score)), 0)

    summary = build_summary(field, score, factors)

    return HealthAssessment(
        field_id=field.id,
        field_name=field.name,
        health_score=score,
        health_status=health_status(score),
        summary=summary,
        factors=sorted(factors, key=lambda f: f.impact, reverse=True),
        conditions=conditions.model_dump(),
        data_source=conditions.source,
    )


def build_summary(field: Field, score: float, factors: list[HealthFactor]) -> str:
    problems = [f for f in factors if f.impact >= 4]
    if not problems:
        return (
            f"{field.name} is in {health_status(score).lower()} condition. "
            "All monitored factors are within their optimal ranges."
        )
    top = problems[:2]
    parts = [f.name.lower() for f in top]
    return (
        f"{field.name} scores {score:.0f}/100 ({health_status(score)}). "
        f"Main pressure from {' and '.join(parts)} — see contributing factors below."
    )


def get_health_trend(
    db: Session,
    field: Field,
    crop: Crop | None,
    conditions: FieldConditions,
    days: int = 30,
) -> list[dict]:
    """Return trend points: persisted metrics history + today's live point."""
    since = datetime.now(UTC) - timedelta(days=days)
    metrics = db.scalars(
        select(HealthMetric)
        .where(HealthMetric.field_id == field.id, HealthMetric.recorded_at >= since)
        .order_by(HealthMetric.recorded_at.asc())
    ).all()

    trend: list[dict] = []
    for metric in metrics:
        trend.append(
            {
                "recorded_at": metric.recorded_at,
                "health_score": metric.health_score,
                "soil_moisture": metric.soil_moisture,
                "air_temperature": metric.air_temperature,
                "humidity": metric.humidity,
            }
        )

    # Today's live value (not yet persisted).
    live_scan = db.scalars(
        select(DiseaseScan)
        .where(DiseaseScan.field_id == field.id)
        .order_by(DiseaseScan.created_at.desc())
        .limit(1)
    ).first()
    live_health = compute_health(field, crop, conditions, live_scan)
    trend.append(
        {
            "recorded_at": datetime.now(UTC),
            "health_score": live_health.health_score,
            "soil_moisture": conditions.soil_moisture,
            "air_temperature": conditions.air_temperature,
            "humidity": conditions.humidity,
        }
    )
    return trend


def health_change_7d(trend: list[dict]) -> float | None:
    if len(trend) < 2:
        return None
    now_score = trend[-1]["health_score"]
    week_ago = next(
        (p for p in reversed(trend[:-1]) if (trend[-1]["recorded_at"] - p["recorded_at"]).days >= 6),
        trend[0],
    )
    return round(now_score - week_ago["health_score"], 1)


def refresh_daily_metrics(db: Session, field: Field, crop: Crop | None, weather) -> None:  # noqa: ANN001
    """Persist any missing daily HealthMetric rows for a field (backfill)."""
    since = datetime.now(UTC) - timedelta(days=30)
    existing = db.scalars(
        select(HealthMetric.recorded_at).where(
            HealthMetric.field_id == field.id,
            HealthMetric.recorded_at >= since,
        )
    ).all()
    existing_days = {ts.date() for ts in existing}

    latest_scan = db.scalars(
        select(DiseaseScan)
        .where(DiseaseScan.field_id == field.id)
        .order_by(DiseaseScan.created_at.desc())
        .limit(1)
    ).first()

    for ts, conditions in generate_history(field, crop, weather.current, days=30):
        if ts.date() in existing_days:
            continue
        health = compute_health(field, crop, conditions, latest_scan)
        db.add(
            HealthMetric(
                field_id=field.id,
                recorded_at=ts,
                health_score=health.health_score,
                soil_moisture=conditions.soil_moisture,
                soil_temperature=conditions.soil_temperature,
                air_temperature=conditions.air_temperature,
                humidity=conditions.humidity,
                disease_risk=conditions.disease_risk,
                water_stress=conditions.water_stress,
                source="simulated",
            )
        )
    db.commit()
