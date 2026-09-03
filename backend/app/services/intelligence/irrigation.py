"""Smart irrigation advisor.

Turns soil moisture + crop demand + weather forecast into an actionable
irrigation recommendation with computed water volumes.
"""

from __future__ import annotations

from app.db.models import Crop, Field
from app.schemas.health import FieldConditions
from app.schemas.weather import ForecastHour


def irrigation_advice(
    field: Field,
    crop: Crop | None,
    conditions: FieldConditions,
    hourly: list[ForecastHour],
) -> dict:
    if crop is not None:
        target_min = crop.optimal_moisture_min
        target_max = crop.optimal_moisture_max
    else:
        target_min, target_max = 28.0, 42.0

    moisture = conditions.soil_moisture
    rain_24 = sum(h.precipitation_mm for h in hourly[:24])
    rain_48 = sum(h.precipitation_mm for h in hourly[:48])
    rain_prob_24 = max((h.rain_probability for h in hourly[:24]), default=0)

    # Root-zone deficit (mm) using a 300mm effective root zone, then apply
    # only the irrigation needed to return to the middle of the target band.
    deficit_fraction = max(0.0, (target_min + 4 - moisture)) / 100.0
    deficit_mm = round(deficit_fraction * 300, 1)

    # Usable rainfall: ~70% of forecast rain is effective.
    effective_rain = round(rain_48 * 0.7, 1)
    water_needed_mm = round(max(0.0, deficit_mm - effective_rain), 1)

    # 1 mm over 1 ha = 10 m³
    volume_m3 = round(water_needed_mm * field.area_hectares * 10, 1)

    reasons: list[str] = []
    recommendation = "hold"
    urgency_hours: int | None = None
    headline = "No irrigation needed right now."

    if moisture < target_min - 6:
        recommendation = "irrigate"
        urgency_hours = 8 if moisture < target_min - 12 else 24
        headline = (
            f"Irrigation recommended for {field.name} within the next "
            f"{urgency_hours} hours."
        )
        reasons = [
            f"Soil moisture {moisture:.0f}% is below the {target_min:.0f}% target",
            f"Crop demand is {conditions.water_demand_mm_per_day:.1f} mm/day "
            f"at the {conditions.growth_stage} stage",
        ]
        if rain_prob_24 < 40:
            reasons.append(f"Low rain probability in the next 24h ({rain_prob_24:.0f}%)")
        else:
            reasons.append(
                f"Rain possible ({rain_prob_24:.0f}%) — apply a reduced volume and re-check"
            )
    elif moisture < target_min:
        recommendation = "monitor"
        urgency_hours = 48
        headline = f"Monitor {field.name} — soil moisture is approaching the target minimum."
        reasons = [
            f"Soil moisture {moisture:.0f}% is just above the {target_min:.0f}% minimum",
            f"Forecast rainfall of {rain_48:.1f} mm over 48h may offset demand",
        ]
    elif moisture > target_max + 8:
        headline = f"Soil is wet ({moisture:.0f}%) — hold irrigation and check drainage."
        reasons = [
            f"Soil moisture {moisture:.0f}% exceeds the {target_max:.0f}% upper target",
            "Allow the profile to drain before the next application",
        ]
    else:
        reasons = [
            f"Soil moisture {moisture:.0f}% is inside the {target_min:.0f}–{target_max:.0f}% band",
        ]
        if rain_48 >= 5:
            reasons.append(f"Forecast rainfall {rain_48:.1f} mm reduces irrigation need")

    return {
        "field_id": field.id,
        "field_name": field.name,
        "recommendation": recommendation,
        "headline": headline,
        "urgency_hours": urgency_hours,
        "soil_moisture": moisture,
        "target_moisture_min": target_min,
        "target_moisture_max": target_max,
        "deficit_mm": deficit_mm,
        "water_needed_mm": water_needed_mm,
        "estimated_volume_m3": volume_m3,
        "forecast_rain_mm": round(rain_48, 1),
        "forecast_rain_24h_mm": round(rain_24, 1),
        "reasons": reasons,
        "status": "open",
        "data_source": conditions.source,
    }
