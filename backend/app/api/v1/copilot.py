"""TerraMind Copilot endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_farm_or_404
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import APIError, not_found
from app.db.models import AIConversation, AIMessage, Alert, Farm, User
from app.schemas.copilot import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotConversationListResponse,
    CopilotConversationResponse,
    CopilotDataSource,
    CopilotMessageResponse,
)
from app.services.copilot.base import CopilotContext
from app.services.copilot.llm import llm_answer
from app.services.copilot.rules import answer_question
from app.services.intelligence.bundle import build_farm_bundles
from app.services.weather import weather_service

router = APIRouter(prefix="/copilot", tags=["copilot"])
settings = get_settings()


@router.post("/chat", response_model=CopilotChatResponse)
async def chat(
    payload: CopilotChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CopilotChatResponse:
    """Ask TerraMind Copilot about the farm. Persists the conversation."""
    farm = _resolve_farm(db, user, payload.farm_id)

    forecast = await weather_service.get_forecast(
        farm.latitude, farm.longitude, farm_id=farm.id
    )
    bundles = build_farm_bundles(db, farm, forecast)
    alerts = db.scalars(
        select(Alert).where(Alert.farm_id == farm.id, Alert.is_resolved.is_(False))
    ).all()

    context = CopilotContext(
        farm=farm,
        fields=[(f, bundles[f.id]) for f in farm.fields if f.id in bundles],
        forecast=forecast,
        alerts=list(alerts),
    )

    if settings.copilot_provider == "openai" and settings.openai_api_key:
        answer = await llm_answer(payload.message, context)
        provider = "openai"
    else:
        answer = answer_question(payload.message, context)
        provider = "rules"

    # Persist conversation.
    conversation = None
    if payload.conversation_id is not None:
        conversation = db.get(AIConversation, payload.conversation_id)
        if conversation is None or conversation.user_id != user.id:
            conversation = None

    if conversation is None:
        conversation = AIConversation(
            user_id=user.id,
            title=payload.message[:60],
        )
        db.add(conversation)
        db.flush()

    db.add(
        AIMessage(
            conversation_id=conversation.id,
            role="user",
            content=payload.message,
            data_sources=[],
            provider=provider,
        )
    )
    db.add(
        AIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=answer.reply,
            data_sources=answer.data_sources,
            provider=provider,
        )
    )
    db.commit()

    return CopilotChatResponse(
        conversation_id=conversation.id,
        reply=answer.reply,
        intent=answer.intent,
        data_sources=[CopilotDataSource(**s) for s in answer.data_sources],
        suggested_questions=answer.suggested_questions,
        provider=provider,
    )


@router.get("/conversations", response_model=CopilotConversationListResponse)
def list_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CopilotConversationListResponse:
    conversations = db.scalars(
        select(AIConversation)
        .where(AIConversation.user_id == user.id)
        .order_by(AIConversation.updated_at.desc())
        .limit(30)
    ).all()
    return CopilotConversationListResponse(
        conversations=[
            {
                "id": c.id,
                "title": c.title,
                "message_count": len(c.messages),
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in conversations
        ]
    )


@router.get("/conversations/{conversation_id}", response_model=CopilotConversationResponse)
def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CopilotConversationResponse:
    conversation = db.get(AIConversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise not_found("Conversation", conversation_id)

    return CopilotConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            CopilotMessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                data_sources=[CopilotDataSource(**s) for s in (m.data_sources or [])],
                created_at=m.created_at,
            )
            for m in conversation.messages
        ],
    )


def _resolve_farm(db: Session, user: User, farm_id: int | None) -> Farm:
    """Find the target farm: explicit id or the user's first farm."""
    if farm_id is not None:
        farm = db.get(Farm, farm_id)
        if farm is None:
            raise not_found("Farm", farm_id)
        if farm.user_id != user.id:
            raise APIError(403, "forbidden", "You do not have access to this farm.")
        return farm

    farm = db.scalars(
        select(Farm)
        .where(Farm.user_id == user.id)
        .order_by(Farm.id)
        .limit(1)
    ).first()
    if farm is None:
        raise APIError(
            400,
            "no_farm",
            "Create a farm first — the copilot answers from your farm data.",
        )
    return farm
