"""Copilot schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CopilotChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: int | None = None
    farm_id: int | None = None


class CopilotDataSource(BaseModel):
    kind: str  # field | weather | alert | scan | irrigation | yield | iot
    label: str
    ref_id: int | None = None


class CopilotChatResponse(BaseModel):
    conversation_id: int
    reply: str
    intent: str
    data_sources: list[CopilotDataSource]
    suggested_questions: list[str]
    provider: str


class CopilotMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    data_sources: list[CopilotDataSource]
    created_at: datetime


class CopilotConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[CopilotMessageResponse]


class CopilotConversationListResponse(BaseModel):
    conversations: list[dict[str, Any]]
