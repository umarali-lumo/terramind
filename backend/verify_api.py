"""End-to-end API verification for the TerraMind backend.

Usage (server must be running):
    python verify_api.py [base_url]        # default http://127.0.0.1:8000

Exercises every router — auth, farms, fields, crops, weather, health,
irrigation, yield, alerts, disease (real model inference), copilot, iot —
then cleans up everything it created so the demo database stays pristine.
"""

from __future__ import annotations

import io
import sys
import time
from datetime import date
from pathlib import Path

import httpx
from PIL import Image, ImageDraw

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
DEMO_EMAIL = "demo@terramind.ai"
DEMO_PASSWORD = "terramind123"

passed = 0
failed = 0


def check(name: str, condition: bool, detail: str = "") -> bool:
    global passed, failed
    ok = bool(condition)
    if ok:
        passed += 1
    else:
        failed += 1
    line = f"  [{'PASS' if ok else 'FAIL'}] {name}"
    if not ok and detail:
        line += f" — {detail}"
    print(line, flush=True)
    return ok


def leaf_image() -> bytes:
    """Synthetic leaf-ish test image (green with a brown lesion)."""
    img = Image.new("RGB", (384, 384), (46, 110, 52))
    draw = ImageDraw.Draw(img)
    draw.ellipse((60, 80, 320, 320), fill=(64, 138, 66))
    draw.ellipse((150, 150, 230, 230), fill=(128, 84, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def main() -> None:
    client = httpx.Client(base_url=BASE, timeout=90)

    print("== System ==")
    r = client.get("/api/health")
    check("GET /api/health", r.status_code == 200 and r.json()["status"] == "ok", r.text)

    # ---------------- Auth ----------------
    print("== Auth ==")
    smoke_email = f"smoke-{int(time.time())}@terramind.ai"
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": smoke_email,
            "full_name": "API Smoke Test",
            "password": "SmokeTest123!",
        },
    )
    check("POST /auth/register", r.status_code == 201, r.text)
    smoke_token = r.json().get("access_token")

    r = client.post(
        "/api/v1/auth/login", json={"email": smoke_email, "password": "SmokeTest123!"}
    )
    check("POST /auth/login (new user)", r.status_code == 200, r.text)
    smoke_token = r.json()["access_token"]
    smoke_headers = {"Authorization": f"Bearer {smoke_token}"}

    r = client.post(
        "/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    check("POST /auth/login (demo)", r.status_code == 200, r.text)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/api/v1/auth/me", headers=headers)
    check("GET /auth/me", r.status_code == 200 and r.json()["email"] == DEMO_EMAIL, r.text)

    r = client.get("/api/v1/farms")
    check("ownership: 401 without token", r.status_code == 401, r.text)

    # ---------------- Crops ----------------
    print("== Crops ==")
    r = client.get("/api/v1/crops", headers=headers)
    crops = r.json().get("crops", [])
    check("GET /crops (8 crops)", r.status_code == 200 and len(crops) == 8, r.text)
    tomato_id = next((c["id"] for c in crops if c["name"] == "Tomato"), None)
    check("tomato crop present", tomato_id is not None)

    # ---------------- Farms ----------------
    print("== Farms ==")
    r = client.get("/api/v1/farms", headers=headers)
    farms = r.json().get("farms", [])
    check("GET /farms", r.status_code == 200 and len(farms) == 1, r.text)
    farm_id = farms[0]["id"] if farms else None
    check("demo farm present", farm_id is not None)

    r = client.get(f"/api/v1/farms/{farm_id}", headers=headers)
    check(
        "GET /farms/{id}",
        r.status_code == 200 and r.json()["field_count"] == 4,
        r.text,
    )

    r = client.get(f"/api/v1/farms/{farm_id}", headers=smoke_headers)
    check("ownership: 403/404 for other user's farm", r.status_code in (403, 404), r.text)

    # Farm CRUD round-trip on the smoke user.
    r = client.post(
        "/api/v1/farms",
        headers=smoke_headers,
        json={
            "name": "Smoke Farm",
            "location_name": "Testville",
            "latitude": 31.5,
            "longitude": 74.3,
        },
    )
    check("POST /farms", r.status_code == 201, r.text)
    smoke_farm_id = r.json()["id"]
    r = client.patch(
        f"/api/v1/farms/{smoke_farm_id}",
        headers=smoke_headers,
        json={"location_name": "Testville East"},
    )
    check("PATCH /farms/{id}", r.status_code == 200, r.text)
    r = client.delete(f"/api/v1/farms/{smoke_farm_id}", headers=smoke_headers)
    check("DELETE /farms/{id}", r.status_code == 204, r.text)

    # ---------------- Farm overview (digital twin payload) ----------------
    print("== Farm overview ==")
    r = client.get(f"/api/v1/farms/{farm_id}/overview", headers=headers)
    ov = r.json()
    check("GET /farms/{id}/overview", r.status_code == 200, r.text)
    check("overview: 4 field cards", len(ov.get("fields", [])) == 4, str(ov.get("fields")))
    check(
        "overview: farm_health aggregate",
        isinstance(ov.get("farm_health", {}).get("average_score"), (int, float)),
    )
    check(
        "overview: weather payload",
        "current" in ov.get("weather", {}) and "hourly" in ov.get("weather", {}),
    )
    check(
        "overview: alerts summary",
        "open_count" in ov.get("alerts", {}) and "latest" in ov.get("alerts", {}),
    )
    check(
        "overview: every field has health + irrigation",
        all(
            "health_score" in f and "irrigation_recommendation" in f
            for f in ov.get("fields", [])
        ),
    )
    check(
        "overview: data source labels present",
        ov.get("data_sources", {}).get("telemetry") == "simulated",
    )

    # ---------------- Fields ----------------
    print("== Fields ==")
    r = client.get(f"/api/v1/fields?farm_id={farm_id}", headers=headers)
    fields = r.json().get("fields", [])
    check("GET /fields?farm_id", r.status_code == 200 and len(fields) == 4, r.text)
    check(
        "fields list carries live health",
        all(f.get("health_score") is not None for f in fields),
    )
    field_id = fields[0]["id"] if fields else None

    r = client.get(f"/api/v1/fields/{field_id}", headers=headers)
    bundle = r.json()
    check("GET /fields/{id} intelligence bundle", r.status_code == 200, r.text)
    expected_keys = [
        "field",
        "conditions",
        "weather",
        "health",
        "stress_risks",
        "irrigation",
        "yield_forecast",
        "latest_disease_scan",
        "health_trend",
    ]
    check(
        "bundle keys complete",
        all(k in bundle for k in expected_keys),
        str(list(bundle.keys())),
    )
    check(
        "health factors explainable",
        len(bundle.get("health", {}).get("factors", [])) >= 3,
    )
    check("health trend ~30 points", len(bundle.get("health_trend", [])) >= 25)

    # Field CRUD round-trip on the demo farm.
    boundary = [[74.20, 31.44], [74.21, 31.44], [74.21, 31.45], [74.20, 31.45]]
    r = client.post(
        f"/api/v1/fields?farm_id={farm_id}",
        headers=headers,
        json={
            "name": "Verify Plot",
            "crop_id": tomato_id,
            "variety": "Test",
            "planting_date": str(date.today()),
            "soil_type": "Loam",
            "soil_ph": 7.0,
            "boundary": boundary,
        },
    )
    check("POST /fields", r.status_code == 201, r.text)
    new_field_id = r.json().get("id")
    check("boundary area computed", (r.json().get("area_hectares") or 0) > 0.5)
    r = client.patch(
        f"/api/v1/fields/{new_field_id}", headers=headers, json={"name": "Verify Plot 2"}
    )
    check("PATCH /fields/{id}", r.status_code == 200, r.text)
    r = client.delete(f"/api/v1/fields/{new_field_id}", headers=headers)
    check("DELETE /fields/{id}", r.status_code == 204, r.text)

    # ---------------- Weather / Health / Irrigation / Yield ----------------
    print("== Intelligence ==")
    r = client.get(f"/api/v1/weather/farms/{farm_id}", headers=headers)
    wx = r.json()
    check(
        "GET /weather/farms/{id}",
        r.status_code == 200
        and "current" in wx
        and "daily" in wx
        and "agriculture_notes" in wx,
        r.text,
    )
    r = client.get(f"/api/v1/weather/fields/{field_id}", headers=headers)
    check("GET /weather/fields/{id}", r.status_code == 200, r.text)

    r = client.get(f"/api/v1/health/fields/{field_id}", headers=headers)
    check(
        "GET /health/fields/{id}",
        r.status_code == 200 and "health_score" in r.json(),
        r.text,
    )
    r = client.get(f"/api/v1/health/farms/{farm_id}", headers=headers)
    check(
        "GET /health/farms/{id}",
        r.status_code == 200 and "fields" in r.json(),
        r.text,
    )

    r = client.get(f"/api/v1/irrigation/farms/{farm_id}", headers=headers)
    check(
        "GET /irrigation/farms/{id}",
        r.status_code == 200 and "recommendations" in r.json(),
        r.text,
    )
    r = client.get(f"/api/v1/irrigation/fields/{field_id}", headers=headers)
    check(
        "GET /irrigation/fields/{id}",
        r.status_code == 200 and "recommendation" in r.json(),
        r.text,
    )

    r = client.get(f"/api/v1/yield/farms/{farm_id}", headers=headers)
    check(
        "GET /yield/farms/{id}",
        r.status_code == 200
        and "fields" in r.json()
        and "total_expected_tons" in r.json(),
        r.text,
    )
    r = client.get(f"/api/v1/yield/fields/{field_id}", headers=headers)
    check(
        "GET /yield/fields/{id}",
        r.status_code == 200 and "expected_yield_t_per_ha" in r.json(),
        r.text,
    )

    # ---------------- Alerts ----------------
    print("== Alerts ==")
    r = client.get(f"/api/v1/alerts?farm_id={farm_id}", headers=headers)
    body = r.json()
    check("GET /alerts?farm_id", r.status_code == 200, r.text)
    alerts = body.get("alerts", [])
    check("alerts generated from intelligence", len(alerts) >= 1, str(body.get("counts")))
    check("alert counts summary", set(body.get("counts", {})) >= {"critical", "warning", "info", "resolved"})

    open_alert = next((a for a in alerts if not a["is_resolved"]), None)
    resolved_id = None
    if open_alert:
        r = client.patch(
            f"/api/v1/alerts/{open_alert['id']}",
            headers=headers,
            json={"is_resolved": True},
        )
        check("PATCH /alerts/{id} resolve", r.status_code == 200 and r.json()["is_resolved"], r.text)
        resolved_id = open_alert["id"]
    else:
        check("PATCH /alerts/{id} resolve", False, "no open alert to test")

    # ---------------- Disease detection (real model) ----------------
    print("== Disease detection ==")
    deadline = time.time() + 300
    model_ready = False
    while time.time() < deadline:
        r = client.get("/api/v1/disease/model")
        model_ready = r.json().get("loaded", False)
        if model_ready:
            break
        time.sleep(3)
    check("GET /disease/model (loaded)", model_ready, r.text)

    r = client.post(
        "/api/v1/disease/scan",
        headers=headers,
        params={"field_id": field_id},
        files={"file": ("leaf.jpg", leaf_image(), "image/jpeg")},
    )
    scan = r.json()
    check("POST /disease/scan", r.status_code == 200, r.text)
    check(
        "scan returns prediction + severity",
        scan.get("disease") and scan.get("severity") and scan.get("confidence", 0) > 0,
        str(scan),
    )
    scan_id = scan.get("id")

    r = client.get("/api/v1/disease/scans", headers=headers)
    check(
        "GET /disease/scans",
        r.status_code == 200 and any(s["id"] == scan_id for s in r.json().get("scans", [])),
        r.text,
    )
    r = client.get(f"/api/v1/disease/scans/{scan_id}", headers=headers)
    check("GET /disease/scans/{id}", r.status_code == 200, r.text)
    r = client.get(f"/api/v1/disease/scans/{scan_id}/image", headers=headers)
    check(
        "GET /disease/scans/{id}/image",
        r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"),
        r.text,
    )

    # ---------------- Copilot ----------------
    print("== Copilot ==")
    r = client.post(
        "/api/v1/copilot/chat",
        headers=headers,
        json={"message": "Which field needs attention today?", "farm_id": farm_id},
    )
    reply = r.json()
    check(
        "POST /copilot/chat",
        r.status_code == 200 and len(reply.get("reply", "")) > 20,
        r.text,
    )
    conv_id = reply.get("conversation_id")

    r = client.post(
        "/api/v1/copilot/chat",
        headers=headers,
        json={
            "message": "How much water does the tomato field need?",
            "conversation_id": conv_id,
            "farm_id": farm_id,
        },
    )
    check("copilot: follow-up in same conversation", r.status_code == 200, r.text)

    r = client.get("/api/v1/copilot/conversations", headers=headers)
    check(
        "GET /copilot/conversations",
        r.status_code == 200 and len(r.json().get("conversations", [])) >= 2,
        r.text,
    )
    r = client.get(f"/api/v1/copilot/conversations/{conv_id}", headers=headers)
    check(
        "GET /copilot/conversations/{id}",
        r.status_code == 200 and len(r.json().get("messages", [])) >= 3,
        r.text,
    )

    # ---------------- IoT ----------------
    print("== IoT ==")
    r = client.get("/api/v1/iot/status", headers=headers)
    check(
        "GET /iot/status (coming soon)",
        r.status_code == 200
        and r.json()["status"] == "coming_soon"
        and r.json()["hardware_available"] is False,
        r.text,
    )

    r = client.post(
        "/api/v1/iot/nodes",
        headers=headers,
        json={"field_id": field_id, "name": "Verify Node"},
    )
    check("POST /iot/nodes", r.status_code == 201, r.text)
    node = r.json()
    node_id, device_key = node["id"], node["device_key"]

    r = client.post(
        f"/api/v1/iot/nodes/{node_id}/simulate", headers=headers, params={"hours": 6}
    )
    check(
        "POST /iot/nodes/{id}/simulate",
        r.status_code == 200 and len(r.json().get("readings", [])) == 6,
        r.text,
    )
    r = client.get(f"/api/v1/iot/nodes/{node_id}/readings", headers=headers)
    check(
        "GET /iot/nodes/{id}/readings (simulated flag)",
        r.status_code == 200
        and all(x["is_simulated"] for x in r.json().get("readings", [])),
        r.text,
    )

    r = client.post(
        f"/api/v1/iot/telemetry/{device_key}",
        json={
            "soil_moisture": 38.5,
            "soil_ph": 6.9,
            "temperature": 29.1,
            "humidity": 61.0,
            "battery_level": 92.0,
            "signal_strength": 74.0,
        },
    )
    check(
        "POST /iot/telemetry/{device_key} (ESP32 contract)",
        r.status_code == 201 and r.json()["is_simulated"] is False,
        r.text,
    )

    r = client.delete(f"/api/v1/iot/nodes/{node_id}", headers=headers)
    check("DELETE /iot/nodes/{id}", r.status_code == 204, r.text)

    client.close()

    # ---------------- Cleanup (keep the demo database pristine) -------------
    cleanup(smoke_email, scan_id, resolved_id)

    print()
    print(f"RESULT: {passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


def cleanup(smoke_email: str, scan_id: int | None, resolved_id: int | None) -> None:
    """Remove rows created by this verification run (direct DB access)."""
    from app.core.database import SessionLocal
    from app.core.config import get_settings
    from app.db.models import Alert, DiseaseScan, User

    settings = get_settings()
    db = SessionLocal()
    try:
        smoke_user = db.query(User).filter(User.email == smoke_email).first()
        if smoke_user is not None:
            db.delete(smoke_user)

        scan = db.get(DiseaseScan, scan_id) if scan_id else None
        if scan is not None:
            image = Path(settings.upload_dir) / scan.image_filename
            if image.exists():
                image.unlink(missing_ok=True)
            db.delete(scan)

        if resolved_id is not None:
            alert = db.get(Alert, resolved_id)
            if alert is not None:
                alert.is_resolved = False
                alert.resolved_at = None

        db.commit()
        print("  cleanup: verification artifacts removed")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"  cleanup warning: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
