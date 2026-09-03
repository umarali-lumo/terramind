"""TerraMind relational data model.

Hierarchy: User → Farm → Field → (CropCycle, telemetry, intelligence).
Field boundaries are stored as GeoJSON polygons; when TerraMind moves to
PostgreSQL + PostGIS these columns can be migrated to geometry types
without changing the surrounding model.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IntPrimaryKeyMixin, TimestampMixin, UTCTimestamp


# ---------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------

class User(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(256))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    farms: Mapped[list[Farm]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    disease_scans: Mapped[list[DiseaseScan]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    conversations: Mapped[list[AIConversation]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


# ---------------------------------------------------------------------
# Farms & fields
# ---------------------------------------------------------------------

class Farm(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "farms"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    location_name: Mapped[str] = mapped_column(String(160), default="")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    owner: Mapped[User] = relationship(back_populates="farms")
    fields: Mapped[list[Field]] = relationship(
        back_populates="farm",
        cascade="all, delete-orphan",
        order_by="Field.id",
    )
    alerts: Mapped[list[Alert]] = relationship(
        back_populates="farm",
        cascade="all, delete-orphan",
    )
    weather_snapshots: Mapped[list[WeatherSnapshot]] = relationship(
        back_populates="farm",
        cascade="all, delete-orphan",
    )


class Crop(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "crops"

    name: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[str] = mapped_column(String(80))  # cereal, vegetable, fiber...
    growth_days: Mapped[int] = mapped_column(Integer)
    base_yield_t_per_ha: Mapped[float] = mapped_column(Float)
    # Optimal soil-moisture band (volumetric %)
    optimal_moisture_min: Mapped[float] = mapped_column(Float)
    optimal_moisture_max: Mapped[float] = mapped_column(Float)
    # Temperature comfort band (°C)
    optimal_temp_min: Mapped[float] = mapped_column(Float)
    optimal_temp_max: Mapped[float] = mapped_column(Float)
    # Peak daily water demand during mid growth (mm/day)
    peak_water_demand_mm: Mapped[float] = mapped_column(Float)

    fields: Mapped[list[Field]] = relationship(back_populates="crop")
    cycles: Mapped[list[CropCycle]] = relationship(back_populates="crop")


class Field(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "fields"

    farm_id: Mapped[int] = mapped_column(
        ForeignKey("farms.id", ondelete="CASCADE"), index=True
    )
    crop_id: Mapped[int | None] = mapped_column(
        ForeignKey("crops.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(160))
    variety: Mapped[str] = mapped_column(String(120), default="")
    planting_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    growth_stage: Mapped[str] = mapped_column(String(60), default="Establishment")
    soil_type: Mapped[str] = mapped_column(String(60), default="Loam")
    soil_ph: Mapped[float] = mapped_column(Float, default=7.0)
    # GeoJSON Polygon ring: [[lng, lat], ...] — first == last not required.
    boundary: Mapped[list[list[float]] | None] = mapped_column(JSON, nullable=True)
    area_hectares: Mapped[float] = mapped_column(Float, default=0.0)
    latitude: Mapped[float] = mapped_column(Float)  # centroid
    longitude: Mapped[float] = mapped_column(Float)

    farm: Mapped[Farm] = relationship(back_populates="fields")
    crop: Mapped[Crop | None] = relationship(back_populates="fields")
    cycles: Mapped[list[CropCycle]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    health_metrics: Mapped[list[HealthMetric]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    disease_scans: Mapped[list[DiseaseScan]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    irrigation_recommendations: Mapped[list[IrrigationRecommendation]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    yield_predictions: Mapped[list[YieldPrediction]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    alerts: Mapped[list[Alert]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    sensor_nodes: Mapped[list[SensorNode]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )


class CropCycle(Base, IntPrimaryKeyMixin, TimestampMixin):
    """A planting season on a field; enables historical comparison."""

    __tablename__ = "crop_cycles"

    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), index=True
    )
    crop_id: Mapped[int] = mapped_column(ForeignKey("crops.id"), index=True)
    variety: Mapped[str] = mapped_column(String(120), default="")
    season_label: Mapped[str] = mapped_column(String(60), default="")
    planting_date: Mapped[date] = mapped_column(Date)
    harvest_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|completed
    actual_yield_t_per_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    field: Mapped[Field] = relationship(back_populates="cycles")
    crop: Mapped[Crop] = relationship(back_populates="cycles")


# ---------------------------------------------------------------------
# Telemetry & intelligence
# ---------------------------------------------------------------------

class HealthMetric(Base, IntPrimaryKeyMixin):
    """Daily per-field condition snapshot feeding health scores & trends."""

    __tablename__ = "health_metrics"

    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(UTCTimestamp, index=True)
    health_score: Mapped[int] = mapped_column(Float)
    soil_moisture: Mapped[float] = mapped_column(Float)
    soil_temperature: Mapped[float] = mapped_column(Float)
    air_temperature: Mapped[float] = mapped_column(Float)
    humidity: Mapped[float] = mapped_column(Float)
    disease_risk: Mapped[float] = mapped_column(Float)
    water_stress: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(20), default="simulated")

    field: Mapped[Field] = relationship(back_populates="health_metrics")


class DiseaseScan(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "disease_scans"
    __table_args__ = (
        Index("ix_disease_scans_field_created", "field_id", "created_at"),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    field_id: Mapped[int | None] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), nullable=True, index=True
    )
    image_filename: Mapped[str] = mapped_column(String(300), default="")
    detected_crop: Mapped[str] = mapped_column(String(80), default="Unknown")
    disease: Mapped[str] = mapped_column(String(160))
    confidence: Mapped[float] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(20), default="Unknown")
    disease_risk: Mapped[int] = mapped_column(Integer, default=0)
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=False)
    recommended_action: Mapped[str] = mapped_column(Text, default="")
    top_predictions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    user: Mapped[User] = relationship(back_populates="disease_scans")
    field: Mapped[Field | None] = relationship(back_populates="disease_scans")


class WeatherSnapshot(Base, IntPrimaryKeyMixin):
    """Latest observed weather per farm; future ML training data."""

    __tablename__ = "weather_snapshots"

    farm_id: Mapped[int] = mapped_column(
        ForeignKey("farms.id", ondelete="CASCADE"), index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(UTCTimestamp, index=True)
    temperature: Mapped[float] = mapped_column(Float)
    humidity: Mapped[float] = mapped_column(Float)
    wind_speed: Mapped[float] = mapped_column(Float)
    precipitation_mm: Mapped[float] = mapped_column(Float, default=0.0)
    rain_probability: Mapped[float] = mapped_column(Float, default=0.0)
    weather_code: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str] = mapped_column(String(120), default="")
    source: Mapped[str] = mapped_column(String(20), default="open_meteo")

    farm: Mapped[Farm] = relationship(back_populates="weather_snapshots")


class IrrigationRecommendation(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "irrigation_recommendations"

    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), index=True
    )
    recommendation: Mapped[str] = mapped_column(String(20))  # irrigate|monitor|hold
    urgency_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    soil_moisture: Mapped[float] = mapped_column(Float)
    target_moisture_min: Mapped[float] = mapped_column(Float)
    target_moisture_max: Mapped[float] = mapped_column(Float)
    water_needed_mm: Mapped[float] = mapped_column(Float)
    estimated_volume_m3: Mapped[float] = mapped_column(Float, default=0.0)
    forecast_rain_mm: Mapped[float] = mapped_column(Float, default=0.0)
    reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|done|dismissed

    field: Mapped[Field] = relationship(back_populates="irrigation_recommendations")


class YieldPrediction(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "yield_predictions"

    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), index=True
    )
    expected_yield_t_per_ha: Mapped[float] = mapped_column(Float)
    min_yield_t_per_ha: Mapped[float] = mapped_column(Float)
    max_yield_t_per_ha: Mapped[float] = mapped_column(Float)
    total_expected_tons: Mapped[float] = mapped_column(Float)
    previous_yield_t_per_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    trend_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    expected_harvest_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    factors: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    field: Mapped[Field] = relationship(back_populates="yield_predictions")


class Alert(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alerts_farm_status", "farm_id", "is_resolved"),
        UniqueConstraint("farm_id", "signature", name="uq_alert_signature"),
    )

    farm_id: Mapped[int] = mapped_column(
        ForeignKey("farms.id", ondelete="CASCADE"), index=True
    )
    field_id: Mapped[int | None] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), nullable=True
    )
    severity: Mapped[str] = mapped_column(String(20))  # critical|warning|info
    category: Mapped[str] = mapped_column(String(40))
    signature: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    recommended_action: Mapped[str] = mapped_column(Text, default="")
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(
        UTCTimestamp, nullable=True
    )

    farm: Mapped[Farm] = relationship(back_populates="alerts")
    field: Mapped[Field | None] = relationship(back_populates="alerts")


# ---------------------------------------------------------------------
# IoT sensor nodes (hardware coming soon)
# ---------------------------------------------------------------------

class SensorNode(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "sensor_nodes"

    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    device_id: Mapped[str] = mapped_column(String(80), unique=True)
    device_key: Mapped[str] = mapped_column(String(80), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="planned")
    # planned  → hardware not yet deployed
    # online   → sending telemetry (future)
    # offline  → deployed but not reporting (future)
    firmware: Mapped[str] = mapped_column(String(40), default="v0.1.0")
    battery_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    signal_strength: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        UTCTimestamp, nullable=True
    )

    field: Mapped[Field] = relationship(back_populates="sensor_nodes")
    readings: Mapped[list[SensorReading]] = relationship(
        back_populates="node", cascade="all, delete-orphan"
    )


class SensorReading(Base, IntPrimaryKeyMixin):
    __tablename__ = "sensor_readings"
    __table_args__ = (
        Index("ix_sensor_readings_node_time", "node_id", "recorded_at"),
    )

    node_id: Mapped[int] = mapped_column(
        ForeignKey("sensor_nodes.id", ondelete="CASCADE"), index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(UTCTimestamp)
    soil_moisture: Mapped[float] = mapped_column(Float)
    soil_ph: Mapped[float] = mapped_column(Float)
    temperature: Mapped[float] = mapped_column(Float)
    humidity: Mapped[float] = mapped_column(Float)
    battery_level: Mapped[float] = mapped_column(Float, default=100.0)
    signal_strength: Mapped[float] = mapped_column(Float, default=100.0)
    # Simulated telemetry is always labelled — never presented as real sensor data.
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)

    node: Mapped[SensorNode] = relationship(back_populates="readings")


# ---------------------------------------------------------------------
# AI copilot
# ---------------------------------------------------------------------

class AIConversation(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ai_conversations"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), default="New conversation")

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list[AIMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AIMessage.id",
    )


class AIMessage(Base, IntPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ai_messages"

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # user|assistant
    content: Mapped[str] = mapped_column(Text)
    data_sources: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    provider: Mapped[str] = mapped_column(String(20), default="rules")

    conversation: Mapped[AIConversation] = relationship(back_populates="messages")
