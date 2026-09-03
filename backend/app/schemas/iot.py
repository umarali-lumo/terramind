"""IoT sensor-node schemas (hardware coming soon)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SensorNodeCreate(BaseModel):
    field_id: int
    name: str = Field(min_length=2, max_length=120)


class SensorNodeResponse(BaseModel):
    id: int
    field_id: int
    field_name: str | None = None
    name: str
    device_id: str
    # Shown once, right after creation — used to provision the ESP32.
    device_key: str | None = None
    status: str  # planned | online | offline
    firmware: str
    battery_level: float | None
    signal_strength: float | None
    last_seen_at: datetime | None
    reading_count: int = 0
    latest_reading: dict[str, Any] | None = None
    created_at: datetime


class SensorNodeListResponse(BaseModel):
    nodes: list[SensorNodeResponse]


class SensorReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int
    recorded_at: datetime
    soil_moisture: float
    soil_ph: float
    temperature: float
    humidity: float
    battery_level: float
    signal_strength: float
    is_simulated: bool


class SensorReadingListResponse(BaseModel):
    readings: list[SensorReadingResponse]


class TelemetryIngest(BaseModel):
    """Future ESP32 ingest contract (POST /iot/telemetry/{device_key})."""

    soil_moisture: float = Field(ge=0, le=100)
    soil_ph: float = Field(ge=0, le=14)
    temperature: float = Field(ge=-50, le=70)
    humidity: float = Field(ge=0, le=100)
    battery_level: float = Field(default=100.0, ge=0, le=100)
    signal_strength: float = Field(default=100.0, ge=0, le=100)


class IoTStatusResponse(BaseModel):
    hardware_available: bool = False
    status: str = "coming_soon"
    message: str
    node_count: int
    fields_covered: int
    capabilities: list[dict[str, Any]]
