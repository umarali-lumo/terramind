"""Field telemetry provider.

Today this generates deterministic, weather-aware simulated conditions per
field (source="simulated"). When ESP32 nodes come online, `get_conditions`
will read the latest SensorReading instead — every intelligence service
already consumes this abstraction, so no other code changes.
"""

from __future__ import annotations

import hashlib
import math
from datetime import UTC, date, datetime, timedelta

from app.db.models import Crop, Field
from app.schemas.health import FieldConditions
from app.schemas.weather import CurrentWeather

GROWTH_STAGES = [
    (0.08, "Establishment"),
    (0.38, "Vegetative"),
    (0.55, "Flowering"),
    (0.85, "Fruiting"),
    (1.01, "Maturity"),
]

STAGE_WATER_FACTOR = {
    "Establishment": 0.45,
    "Vegetative": 0.75,
    "Flowering": 1.0,
    "Fruiting": 0.95,
    "Maturity": 0.5,
}


def growth_stage_for(crop: Crop | None, planting_date: date | None) -> tuple[str, int | None]:
    """Derive growth stage + days since planting."""
    if crop is None or planting_date is None:
        return "Unknown", None
    days = (date.today() - planting_date).days
    if days < 0:
        return "Pre-planting", days
    progress = days / max(crop.growth_days, 1)
    for threshold, label in GROWTH_STAGES:
        if progress < threshold:
            return label, days
    return "Harvest ready", days


def _noise(seed: str, index: int = 0) -> float:
    digest = hashlib.sha256(f"{seed}:{index}".encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _day_bucket(now: datetime) -> int:
    return int(now.strftime("%Y%m%d"))


def get_conditions(
    field: Field,
    crop: Crop | None,
    weather: CurrentWeather | None,
    now: datetime | None = None,
) -> FieldConditions:
    """Deterministic simulated field conditions, biased by live weather.

    Rain in the forecast raises soil moisture; heat lowers it — this is what
    makes TerraMind's mock layer behave like a connected digital twin.
    """
    now = now or datetime.now(UTC)
    day = _day_bucket(now)
    seed = f"field-{field.id}-day-{day}"

    rain_influence = 0.0
    if weather is not None:
        rain_influence = min(weather.precipitation_mm, 10.0) * 0.8
        if weather.rain_probability >= 60:
            rain_influence += 2.0

    stage, days_since = growth_stage_for(crop, field.planting_date)
    water_factor = STAGE_WATER_FACTOR.get(stage, 0.8)
    base_moisture = 38.0 if crop is None else (crop.optimal_moisture_min + crop.optimal_moisture_max) / 2

    # Field-specific character (soil type shifts retention).
    soil_retention = {
        "Clay": 1.18,
        "Clay Loam": 1.10,
        "Loam": 1.0,
        "Sandy Loam": 0.88,
        "Sand": 0.78,
    }.get(field.soil_type, 1.0)

    air_temperature = (
        weather.temperature if weather is not None else 32.0 + 4 * _noise(seed, 5)
    )
    humidity = weather.humidity if weather is not None else 55.0 + 20 * _noise(seed, 6)

    # Hot + dry + high water demand pulls moisture down; rain pushes it up.
    heat_draw = max(0.0, air_temperature - 30.0) * 0.55 * water_factor
    moisture = (
        base_moisture * soil_retention
        + 8 * (_noise(seed, 1) - 0.5)
        + rain_influence
        - heat_draw
    )
    moisture = round(max(8.0, min(52.0, moisture)), 1)

    soil_temperature = round(air_temperature - 2.5 + 1.5 * _noise(seed, 2), 1)

    # Disease pressure: warm + humid canopy conditions.
    disease_risk = 0.0
    if 20 <= air_temperature <= 30:
        disease_risk += (humidity - 55) * 0.9
    if humidity >= 80:
        disease_risk += 12
    if weather is not None and weather.precipitation_mm > 0:
        disease_risk += 10
    disease_risk = round(max(2.0, min(96.0, disease_risk)), 1)

    # Water stress: moisture deficit vs crop optimum and demand.
    if crop is not None:
        optimum = (crop.optimal_moisture_min + crop.optimal_moisture_max) / 2
        deficit = max(0.0, optimum - moisture)
        water_stress = min(100.0, deficit * 3.2 + heat_draw * 1.6)
    else:
        water_stress = max(0.0, 25.0 - moisture) * 1.5
    water_stress = round(max(1.0, water_stress), 1)

    demand = (
        (crop.peak_water_demand_mm if crop else 5.0)
        * water_factor
        * (1.0 + max(0.0, air_temperature - 30.0) * 0.03)
    )

    return FieldConditions(
        soil_moisture=moisture,
        soil_temperature=soil_temperature,
        air_temperature=round(air_temperature, 1),
        humidity=round(humidity, 0),
        disease_risk=disease_risk,
        water_stress=round(water_stress, 1),
        growth_stage=stage,
        days_since_planting=days_since,
        water_demand_mm_per_day=round(demand, 1),
        source="simulated",
    )


def generate_history(
    field: Field,
    crop: Crop | None,
    weather: CurrentWeather | None,
    days: int = 30,
) -> list[tuple[datetime, FieldConditions]]:
    """Deterministic back-history for trends (same algorithm, past dates)."""
    now = datetime.now(UTC)
    history: list[tuple[datetime, FieldConditions]] = []
    for offset in range(days - 1, -1, -1):
        ts = (now - timedelta(days=offset)).replace(hour=12, minute=0, second=0, microsecond=0)
        conditions = get_conditions(field, crop, weather, now=ts)
        history.append((ts, conditions))
    return history
