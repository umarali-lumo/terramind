"""Shared schema primitives."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    code: str
    message: str


class ErrorEnvelope(BaseModel):
    error: ErrorResponse


class MessageResponse(BaseModel):
    message: str
    data: dict[str, Any] | None = None


class TimestampedModel(ORMModel):
    created_at: datetime
    updated_at: datetime


class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int
