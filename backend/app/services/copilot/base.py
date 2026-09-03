"""Copilot provider contracts & context."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.db.models import Alert, Farm, Field


@dataclass
class CopilotContext:
    """Everything a copilot provider may need to answer a question."""

    farm: Farm
    fields: list[tuple[Field, dict]]  # (field, intelligence bundle)
    forecast: object | None = None  # WeatherForecast
    alerts: list[Alert] = field(default_factory=list)


@dataclass
class CopilotAnswer:
    reply: str
    intent: str
    data_sources: list[dict]
    suggested_questions: list[str]
