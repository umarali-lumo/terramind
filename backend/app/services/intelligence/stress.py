"""Predictive crop-stress engine.

Looks forward 24–72h using weather forecast + current field state to
predict water, heat and disease stress before it becomes visible.
"""

from __future__ import annotations

from app.db.models import Crop, Field
from app.schemas.health import FieldConditions, StressRisk
from app.schemas.weather import CurrentWeather, ForecastDay, ForecastHour


def predict_stress(
    field: Field,
    crop: Crop | None,
    conditions: FieldConditions,
    current: CurrentWeather,
    hourly: list[ForecastHour],
    daily: list[ForecastDay],
) -> list[StressRisk]:
    risks: list[StressRisk] = []

    next_48 = hourly[:48]
    rain_next_48 = sum(h.precipitation_mm for h in next_48)
    rain_prob_next_24 = max((h.rain_probability for h in hourly[:24]), default=0)
    hot_hours_48 = sum(1 for h in next_48 if h.temperature >= (crop.optimal_temp_max if crop else 36))
    humid_hours_48 = sum(1 for h in next_48 if h.humidity >= 85)
    max_temp = max((h.temperature for h in next_48), default=current.temperature)

    # ---------------- Water stress ----------------
    if crop is not None:
        optimum = (crop.optimal_moisture_min + crop.optimal_moisture_max) / 2
        target_min = crop.optimal_moisture_min
    else:
        optimum, target_min = 35.0, 28.0

    deficit = max(0.0, target_min - conditions.soil_moisture)
    demand_48 = conditions.water_demand_mm_per_day * 2
    effective_rain = min(rain_next_48 * 0.7, demand_48)

    # Probability that moisture falls below target within 48h.
    stress_score = (
        deficit * 2.6
        + max(0.0, conditions.soil_moisture - optimum + deficit) * 0
        + max(0.0, demand_48 - effective_rain) * 4.0
        + (12 if conditions.growth_stage in ("Flowering", "Fruiting") else 0)
        - rain_prob_next_24 * 0.15
    )
    stress_probability = max(3.0, min(96.0, stress_score))

    if stress_probability >= 70:
        level = "high"
    elif stress_probability >= 45:
        level = "moderate"
    else:
        level = "low"

    if level != "low":
        if crop is not None:
            window = 24 if stress_probability >= 75 else 48
        else:
            window = 48
        contributing = [
            f"Soil moisture at {conditions.soil_moisture:.0f}% (target ≥ {target_min:.0f}%)",
            f"~{demand_48 - effective_rain:.1f} mm net water deficit over 48h",
            f"Growth stage {conditions.growth_stage} (demand "
            f"{conditions.water_demand_mm_per_day:.1f} mm/day)",
        ]
        if rain_next_48 < 2:
            contributing.append(f"Low forecast rainfall ({rain_next_48:.1f} mm in 48h)")
        else:
            contributing.append(f"Forecast rainfall {rain_next_48:.1f} mm may partially offset demand")
        risks.append(
            StressRisk(
                field_id=field.id,
                field_name=field.name,
                risk_type="water",
                level=level,
                probability=round(stress_probability, 0),
                window_hours=window,
                contributing_factors=contributing,
                prediction=(
                    f"{field.name} has a {level} probability of water stress within the next "
                    f"{window} hours."
                ),
                recommended_action=(
                    "Irrigate before the crop enters visible wilt — see the Irrigation "
                    "module for a computed recommendation."
                    if level == "high"
                    else "Schedule irrigation within 24–48h and re-check moisture after any rainfall."
                ),
            )
        )

    # ---------------- Heat stress ----------------
    heat_score = hot_hours_48 * 6 + max(0.0, max_temp - (crop.optimal_temp_max if crop else 36)) * 9
    heat_probability = max(3.0, min(96.0, heat_score))
    if heat_probability >= 55:
        level = "high" if heat_probability >= 75 else "moderate"
        risks.append(
            StressRisk(
                field_id=field.id,
                field_name=field.name,
                risk_type="heat",
                level=level,
                probability=round(heat_probability, 0),
                window_hours=48,
                contributing_factors=[
                    f"{hot_hours_48} hours above crop comfort band in the next 48h",
                    f"Peak forecast temperature {max_temp:.0f}°C",
                ],
                prediction=(
                    f"{field.name} is likely to experience heat stress in the next 48 hours "
                    f"({hot_hours_48}h above threshold)."
                ),
                recommended_action=(
                    "Irrigate during cooler hours to offset transpiration demand and avoid "
                    "midday field operations."
                ),
            )
        )

    # ---------------- Disease risk ----------------
    disease_score = (
        conditions.disease_risk * 0.55
        + humid_hours_48 * 1.4
        + (18 if rain_next_48 > 4 else 0)
    )
    disease_probability = max(3.0, min(96.0, disease_score))
    if disease_probability >= 55:
        level = "high" if disease_probability >= 75 else "moderate"
        risks.append(
            StressRisk(
                field_id=field.id,
                field_name=field.name,
                risk_type="disease",
                level=level,
                probability=round(disease_probability, 0),
                window_hours=72,
                contributing_factors=[
                    f"Current disease pressure {conditions.disease_risk:.0f}/100",
                    f"{humid_hours_48} hours of high humidity forecast",
                ] + (
                    [f"{rain_next_48:.0f} mm rain forecast favours fungal spread"]
                    if rain_next_48 > 4
                    else []
                ),
                prediction=(
                    f"Environmental conditions favour disease development on {field.name} "
                    "over the next 72 hours."
                ),
                recommended_action=(
                    "Scout the canopy for early lesions and consider a protectant treatment "
                    "aligned with local agronomic guidance."
                ),
            )
        )

    return risks


def max_risk_level(risks: list[StressRisk]) -> tuple[str, float]:
    """Highest (level, probability) across all risk types."""
    order = {"low": 0, "moderate": 1, "high": 2, "severe": 3}
    best_level, best_prob = "low", 0.0
    for risk in risks:
        if order[risk.level] > order[best_level]:
            best_level, best_prob = risk.level, risk.probability
        elif risk.level == best_level:
            best_prob = max(best_prob, risk.probability)
    return best_level, best_prob
