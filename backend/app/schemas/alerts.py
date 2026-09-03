"""Alert schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: int
    farm_id: int
    field_id: int | None
    field_name: str | None
    severity: str
    category: str
    title: str
    message: str
    recommended_action: str
    is_resolved: bool
    resolved_at: datetime | None
    created_at: datetime

    @classmethod
    def from_alert(cls, alert, field_name: str | None = None) -> AlertResponse:
        return cls(
            id=alert.id,
            farm_id=alert.farm_id,
            field_id=alert.field_id,
            field_name=field_name,
            severity=alert.severity,
            category=alert.category,
            title=alert.title,
            message=alert.message,
            recommended_action=alert.recommended_action,
            is_resolved=alert.is_resolved,
            resolved_at=alert.resolved_at,
            created_at=alert.created_at,
        )


class AlertListResponse(BaseModel):
    alerts: list[AlertResponse]
    counts: dict[str, int]


class AlertUpdate(BaseModel):
    is_resolved: bool
