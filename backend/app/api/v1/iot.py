"""IoT sensor-node endpoints (hardware coming soon).

Nodes can be registered and simulated telemetry generated today —
clearly labelled as simulated. The ingest endpoint implements the future
ESP32 → HTTP contract so hardware bring-up later needs zero backend
changes: ESP32 → POST /iot/telemetry/{device_key} → DB → digital twin.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_field_or_404
from app.core.database import get_db
from app.core.errors import APIError, bad_request, not_found
from app.core.security import new_device_key
from app.db.models import (
    Farm,
    Field,
    SensorNode,
    SensorReading,
    User,
)
from app.schemas.iot import (
    IoTStatusResponse,
    SensorNodeCreate,
    SensorNodeListResponse,
    SensorNodeResponse,
    SensorReadingListResponse,
    SensorReadingResponse,
    TelemetryIngest,
)
from app.services.iot import simulate_history, simulate_reading

router = APIRouter(prefix="/iot", tags=["iot"])


@router.get("/status", response_model=IoTStatusResponse)
def iot_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IoTStatusResponse:
    """Ecosystem status for the IoT page — clearly marked Coming Soon."""
    nodes = _user_nodes(db, user)
    field_ids = {n.field_id for n in nodes}
    return IoTStatusResponse(
        hardware_available=False,
        status="coming_soon",
        message=(
            "TerraMind Field Nodes (ESP32) are in development. Nodes registered "
            "here show simulated telemetry so you can preview the experience — "
            "simulated data is always labelled as such."
        ),
        node_count=len(nodes),
        fields_covered=len(field_ids),
        capabilities=[
            {
                "sensor": "Soil Moisture",
                "unit": "%",
                "description": "Capacitive soil-moisture probe at root depth.",
            },
            {
                "sensor": "Soil pH",
                "unit": "pH",
                "description": "Electrode-based soil acidity/alkalinity reading.",
            },
            {
                "sensor": "Temperature",
                "unit": "°C",
                "description": "Ambient air temperature above the canopy.",
            },
            {
                "sensor": "Humidity",
                "unit": "%",
                "description": "Relative humidity for disease-pressure modelling.",
            },
        ],
    )


@router.get("/nodes", response_model=SensorNodeListResponse)
def list_nodes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SensorNodeListResponse:
    return SensorNodeListResponse(nodes=[_node_response(db, n) for n in _user_nodes(db, user)])


@router.post("/nodes", response_model=SensorNodeResponse, status_code=status.HTTP_201_CREATED)
def create_node(
    payload: SensorNodeCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SensorNodeResponse:
    field = db.get(Field, payload.field_id)
    if field is None:
        raise not_found("Field", payload.field_id)
    if field.farm.user_id != user.id:
        raise APIError(403, "forbidden", "You do not have access to this field.")

    node = SensorNode(
        field_id=field.id,
        name=payload.name,
        device_id=f"TM-ESP32-{new_device_key()[3:11].upper()}",
        device_key=new_device_key(),
        status="planned",
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    response = _node_response(db, node)
    # The device key is returned only once, at provisioning time.
    response.device_key = node.device_key
    return response


@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(
    node_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    node = db.get(SensorNode, node_id)
    if node is None or node.field.farm.user_id != user.id:
        raise not_found("Sensor node", node_id)
    db.delete(node)
    db.commit()


@router.post("/nodes/{node_id}/simulate", response_model=SensorReadingListResponse)
def simulate_telemetry(
    node_id: int,
    hours: int = 48,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SensorReadingListResponse:
    """Generate clearly-labelled simulated telemetry for a node."""
    node = db.get(SensorNode, node_id)
    if node is None or node.field.farm.user_id != user.id:
        raise not_found("Sensor node", node_id)

    hours = max(1, min(hours, 72))
    for reading in simulate_history(node, hours=hours):
        db.add(reading)

    node.last_seen_at = datetime.now(UTC)
    node.status = "planned"  # still not real hardware
    db.commit()

    readings = db.scalars(
        select(SensorReading)
        .where(SensorReading.node_id == node.id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(hours)
    ).all()
    return SensorReadingListResponse(
        readings=[SensorReadingResponse.model_validate(r) for r in readings]
    )


@router.get("/nodes/{node_id}/readings", response_model=SensorReadingListResponse)
def node_readings(
    node_id: int,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SensorReadingListResponse:
    node = db.get(SensorNode, node_id)
    if node is None or node.field.farm.user_id != user.id:
        raise not_found("Sensor node", node_id)

    readings = db.scalars(
        select(SensorReading)
        .where(SensorReading.node_id == node.id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(min(limit, 500))
    ).all()
    return SensorReadingListResponse(
        readings=[SensorReadingResponse.model_validate(r) for r in readings]
    )


@router.post(
    "/telemetry/{device_key}", response_model=SensorReadingResponse, status_code=status.HTTP_201_CREATED
)
def ingest_telemetry(
    device_key: str,
    payload: TelemetryIngest,
    db: Session = Depends(get_db),
) -> SensorReadingResponse:
    """Future ESP32 ingest contract (device-key authenticated).

    The physical nodes are not deployed yet, but this endpoint is the
    stable contract they will POST to. Returns 404 for unknown keys.
    """
    node = db.scalars(
        select(SensorNode).where(SensorNode.device_key == device_key)
    ).first()
    if node is None:
        raise not_found("Sensor node")

    reading = SensorReading(
        node_id=node.id,
        recorded_at=datetime.now(UTC),
        soil_moisture=payload.soil_moisture,
        soil_ph=payload.soil_ph,
        temperature=payload.temperature,
        humidity=payload.humidity,
        battery_level=payload.battery_level,
        signal_strength=payload.signal_strength,
        is_simulated=False,  # Real hardware reading
    )
    node.status = "online"
    node.last_seen_at = reading.recorded_at
    node.battery_level = payload.battery_level
    node.signal_strength = payload.signal_strength

    db.add(reading)
    db.commit()
    db.refresh(reading)
    return SensorReadingResponse.model_validate(reading)


# ----------------------------------------------------------------------
def _user_nodes(db: Session, user: User) -> list[SensorNode]:
    farm_ids = select(Farm.id).where(Farm.user_id == user.id)
    return db.scalars(
        select(SensorNode)
        .join(Field, SensorNode.field_id == Field.id)
        .where(Field.farm_id.in_(farm_ids))
        .order_by(SensorNode.id)
    ).all()


def _node_response(db: Session, node: SensorNode) -> SensorNodeResponse:
    count = db.scalar(
        select(func.count()).where(SensorReading.node_id == node.id)
    ) or 0
    latest = db.scalars(
        select(SensorReading)
        .where(SensorReading.node_id == node.id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(1)
    ).first()

    return SensorNodeResponse(
        id=node.id,
        field_id=node.field_id,
        field_name=node.field.name if node.field else None,
        name=node.name,
        device_id=node.device_id,
        status=node.status,
        firmware=node.firmware,
        battery_level=node.battery_level,
        signal_strength=node.signal_strength,
        last_seen_at=node.last_seen_at,
        reading_count=count,
        latest_reading=(
            {
                "recorded_at": latest.recorded_at.isoformat(),
                "soil_moisture": latest.soil_moisture,
                "soil_ph": latest.soil_ph,
                "temperature": latest.temperature,
                "humidity": latest.humidity,
                "battery_level": latest.battery_level,
                "is_simulated": latest.is_simulated,
            }
            if latest
            else None
        ),
        created_at=node.created_at,
    )
