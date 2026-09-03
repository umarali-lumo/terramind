"""TerraMind demo data seeding.

Creates a realistic demo farm (Green Valley Farm near Lahore, Punjab)
with crops, field boundaries, 30 days of health metrics, disease scans,
sensor nodes and alerts. Runs idempotently.
"""

from __future__ import annotations

import sys
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

# Allow `python -m app.seed` execution from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, engine  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.core.security import hash_password, new_device_key  # noqa: E402
from app.db.models import (  # noqa: E402
    AIConversation,
    AIMessage,
    Alert,
    Crop,
    CropCycle,
    DiseaseScan,
    Farm,
    Field,
    HealthMetric,
    SensorNode,
    SensorReading,
    User,
)
from app.services.disease.knowledge import recommended_action, severity_for  # noqa: E402
from app.services.iot import simulate_history  # noqa: E402
from app.services.telemetry import generate_history  # noqa: E402
from app.services.intelligence.health import compute_health  # noqa: E402

DEMO_EMAIL = "demo@terramind.ai"
DEMO_PASSWORD = "terramind123"

CROPS = [
    # name, category, growth_days, base_yield, moist_min, moist_max, temp_min, temp_max, peak_water
    ("Tomato", "Vegetable", 110, 45.0, 30, 42, 15, 32, 5.5),
    ("Wheat", "Cereal", 140, 4.8, 28, 40, 10, 28, 5.0),
    ("Rice", "Cereal", 130, 6.5, 40, 55, 20, 35, 9.0),
    ("Maize", "Cereal", 105, 9.0, 30, 45, 15, 33, 6.5),
    ("Cotton", "Fiber", 165, 3.2, 28, 40, 18, 35, 6.0),
    ("Sugarcane", "Industrial", 330, 80.0, 38, 52, 20, 38, 8.0),
    ("Potato", "Vegetable", 100, 28.0, 30, 45, 10, 25, 5.0),
    ("Chickpea", "Legume", 110, 1.8, 25, 38, 12, 30, 4.0),
]

# Field boundaries near Lahore (Green Valley Farm concept from the MVP).
GREEN_VALLEY_CENTER = (31.4500, 74.2300)

FIELDS = [
    {
        "name": "North Tomato Block",
        "crop": "Tomato",
        "variety": "Roma VF",
        "planting_days_ago": 55,
        "soil_type": "Loam",
        "soil_ph": 6.8,
        "offset": (0.010, -0.008),
        "size": (0.006, 0.005),
        "history_cycle_yield": 41.5,
    },
    {
        "name": "Wheat Terrace",
        "crop": "Wheat",
        "variety": "Galaxy-13",
        "planting_days_ago": 96,
        "soil_type": "Clay Loam",
        "soil_ph": 7.4,
        "offset": (0.010, 0.008),
        "size": (0.007, 0.006),
        "history_cycle_yield": 4.3,
    },
    {
        "name": "Maize East",
        "crop": "Maize",
        "variety": "DK-6789",
        "planting_days_ago": 38,
        "soil_type": "Sandy Loam",
        "soil_ph": 6.5,
        "offset": (-0.012, 0.000),
        "size": (0.006, 0.007),
        "history_cycle_yield": 8.1,
    },
    {
        "name": "Cotton South",
        "crop": "Cotton",
        "variety": "Bt-121",
        "planting_days_ago": 78,
        "soil_type": "Loam",
        "soil_ph": 7.9,
        "offset": (-0.004, -0.014),
        "size": (0.008, 0.005),
        "history_cycle_yield": 2.9,
    },
]


def make_boundary(offset: tuple[float, float], size: tuple[float, float]) -> list[list[float]]:
    """Rectangle boundary [lng, lat] around the farm center."""
    lat, lng = GREEN_VALLEY_CENTER
    dlat, dlng = offset
    h, w = size
    return [
        [lng + dlng - w / 2, lat + dlat - h / 2],
        [lng + dlng + w / 2, lat + dlat - h / 2],
        [lng + dlng + w / 2, lat + dlat + h / 2],
        [lng + dlng - w / 2, lat + dlat + h / 2],
    ]


def seed() -> None:
    print("Seeding TerraMind demo data ...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(User).filter(User.email == DEMO_EMAIL).first() is not None:
            print("Demo data already present — nothing to do.")
            return

        # ---- Demo user -------------------------------------------------
        user = User(
            email=DEMO_EMAIL,
            full_name="Umar Aslam",
            password_hash=hash_password(DEMO_PASSWORD),
            is_demo=True,
        )
        db.add(user)
        db.flush()
        print(f"  user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

        # ---- Crop catalog ----------------------------------------------
        crops: dict[str, Crop] = {}
        for name, category, growth, base_y, m_min, m_max, t_min, t_max, water in CROPS:
            crop = Crop(
                name=name,
                category=category,
                growth_days=growth,
                base_yield_t_per_ha=base_y,
                optimal_moisture_min=m_min,
                optimal_moisture_max=m_max,
                optimal_temp_min=t_min,
                optimal_temp_max=t_max,
                peak_water_demand_mm=water,
            )
            db.add(crop)
            crops[name] = crop
        db.flush()
        print(f"  crops: {len(crops)}")

        # ---- Farm ------------------------------------------------------
        farm = Farm(
            user_id=user.id,
            name="Green Valley Farm",
            location_name="Lahore District, Punjab, Pakistan",
            latitude=GREEN_VALLEY_CENTER[0],
            longitude=GREEN_VALLEY_CENTER[1],
            is_primary=True,
        )
        db.add(farm)
        db.flush()
        print(f"  farm: {farm.name}")

        # ---- Fields ----------------------------------------------------
        from app.services.geo import ring_area_hectares, ring_centroid

        for spec in FIELDS:
            boundary = make_boundary(spec["offset"], spec["size"])
            lng, lat = ring_centroid(boundary)
            crop = crops[spec["crop"]]
            planting = date.today() - timedelta(days=spec["planting_days_ago"])

            field = Field(
                farm_id=farm.id,
                crop_id=crop.id,
                name=spec["name"],
                variety=spec["variety"],
                planting_date=planting,
                growth_stage="Unknown",
                soil_type=spec["soil_type"],
                soil_ph=spec["soil_ph"],
                boundary=boundary,
                area_hectares=ring_area_hectares(boundary),
                latitude=lat,
                longitude=lng,
            )
            db.add(field)
            db.flush()

            from app.services.telemetry import growth_stage_for

            field.growth_stage = growth_stage_for(crop, planting)[0]

            # Previous completed cycle for yield comparison.
            db.add(
                CropCycle(
                    field_id=field.id,
                    crop_id=crop.id,
                    variety=spec["variety"],
                    season_label=f"Season {planting.year - 1}",
                    planting_date=planting - timedelta(days=crop.growth_days + 20),
                    harvest_date=planting - timedelta(days=20),
                    status="completed",
                    actual_yield_t_per_ha=spec["history_cycle_yield"],
                )
            )
            db.add(
                CropCycle(
                    field_id=field.id,
                    crop_id=crop.id,
                    variety=spec["variety"],
                    season_label=f"Season {planting.year}",
                    planting_date=planting,
                    status="active",
                )
            )
            print(f"    field: {field.name} ({field.area_hectares:.1f} ha, {crop.name})")

        db.flush()

        # ---- 30 days of health metrics per field ------------------------
        now = datetime.now(UTC)
        for field in farm.fields:
            crop = field.crop
            for ts, conditions in generate_history(field, crop, weather=None, days=30):
                latest_scan = None
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
        print("  metrics: 30 days x fields")

        # ---- Disease scan history ---------------------------------------
        tomato_field = farm.fields[0]  # North Tomato Block
        wheat_field = farm.fields[1]

        scans = [
            (
                tomato_field,
                "Tomato",
                "Early Blight",
                94.2,
                4,
            ),
            (
                tomato_field,
                "Tomato",
                "Healthy",
                97.8,
                12,
            ),
            (
                wheat_field,
                "Wheat",
                "Leaf Rust",
                88.6,
                6,
            ),
        ]
        for field, crop_name, disease, confidence, days_ago in scans:
            db.add(
                DiseaseScan(
                    user_id=user.id,
                    field_id=field.id,
                    image_filename="",  # historical scans keep no image file
                    detected_crop=crop_name,
                    disease=disease,
                    confidence=confidence,
                    severity=severity_for(disease, confidence),
                    disease_risk=85 if confidence >= 90 else 70,
                    is_healthy="healthy" in disease.lower(),
                    recommended_action=recommended_action(disease),
                    top_predictions=[
                        {"label": f"{crop_name}___{disease.replace(' ', '_')}",
                         "crop": crop_name, "disease": disease, "confidence": confidence}
                    ],
                    created_at=now - timedelta(days=days_ago),
                )
            )
        print("  disease scans: 3 (seed history)")

        # ---- Sensor nodes (planned) with simulated telemetry ------------
        node = SensorNode(
            field_id=tomato_field.id,
            name="Field Node A1",
            device_id=f"TM-ESP32-{new_device_key()[3:11].upper()}",
            device_key=new_device_key(),
            status="planned",
        )
        db.add(node)
        db.flush()
        for reading in simulate_history(node, hours=48):
            db.add(reading)
        print("  sensor nodes: 1 planned (48h simulated telemetry)")

        # ---- A starter copilot conversation ------------------------------
        conversation = AIConversation(
            user_id=user.id,
            title="Getting started with TerraMind",
        )
        db.add(conversation)
        db.flush()
        db.add(
            AIMessage(
                conversation_id=conversation.id,
                role="user",
                content="Which field needs attention today?",
            )
        )
        db.add(
            AIMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=(
                    "Welcome to TerraMind! I've indexed Green Valley Farm with 4 "
                    "fields. Ask me about irrigation, disease risk, weather or "
                    "yield — or open the Overview to see the full picture."
                ),
                data_sources=[{"kind": "field", "label": "all fields"}],
                provider="rules",
            )
        )
        print("  copilot: starter conversation")

        db.commit()
        print("Seed complete.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # On container/serverless starts, several instances may race to seed a
    # fresh shared database at once. The seed runs as one transaction, so a
    # lost race rolls back cleanly — retrying then finds the winner's data.
    for attempt in range(3):
        try:
            seed()
            break
        except Exception:
            if attempt == 2:
                raise
            print(f"Seed attempt {attempt + 1} failed — retrying in 3s ...")
            time.sleep(3)
