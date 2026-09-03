"""IoT sensor-node simulation.

The ESP32 hardware is coming soon. This module generates clearly-labelled
simulated telemetry (is_simulated=True) so the future telemetry pipeline
(DB → digital twin → AI) is fully exercised today.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

from app.db.models import SensorNode, SensorReading


def _noise(seed: str) -> float:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def simulate_reading(node: SensorNode, at: datetime | None = None) -> SensorReading:
    """Deterministic simulated ESP32 telemetry reading for a node."""
    at = at or datetime.now(UTC)
    seed = f"node-{node.id}-{at.strftime('%Y%m%d%H')}"

    moisture = 24 + 22 * _noise(f"{seed}:m")
    soil_ph = 6.2 + 1.2 * _noise(f"{seed}:ph")
    temperature = 26 + 10 * _noise(f"{seed}:t")
    humidity = 45 + 35 * _noise(f"{seed}:h")
    battery = max(20.0, 100 - 40 * _noise(f"{seed}:b"))
    signal = max(35.0, 100 - 45 * _noise(f"{seed}:s"))

    return SensorReading(
        node_id=node.id,
        recorded_at=at,
        soil_moisture=round(moisture, 1),
        soil_ph=round(soil_ph, 1),
        temperature=round(temperature, 1),
        humidity=round(humidity, 1),
        battery_level=round(battery, 0),
        signal_strength=round(signal, 0),
        is_simulated=True,  # Never presented as real sensor data
    )


def simulate_history(node: SensorNode, hours: int = 48) -> list[SensorReading]:
    """Backfill simulated readings for a node (hourly)."""
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    readings: list[SensorReading] = []
    for offset in range(hours, 0, -1):
        readings.append(simulate_reading(node, at=now - timedelta(hours=offset)))
    return readings
