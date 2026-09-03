"""Optional LLM copilot provider (OpenAI-compatible chat-completions).

Enabled via environment variables:
    COPILOT_PROVIDER=openai
    OPENAI_API_KEY=sk-...
    OPENAI_BASE_URL=https://api.openai.com/v1   (or any compatible gateway)
    OPENAI_MODEL=gpt-4o-mini

The LLM receives a compact, structured farm context and answers grounded
in live TerraMind data. When disabled or unreachable, the rules engine
answers instead — the API contract is identical.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings
from app.services.copilot.base import CopilotAnswer, CopilotContext
from app.services.copilot.rules import SUGGESTIONS, answer_question

logger = logging.getLogger("terramind.copilot")

settings = get_settings()

SYSTEM_PROMPT = """You are TerraMind Copilot, an agricultural intelligence assistant.
Answer the farmer's question using ONLY the farm data provided below.
Be concise, specific and practical. Reference concrete field names, numbers and units.
When data is missing, say so. Suggest sensible next actions where appropriate.
Respond in short markdown (bullets, bold field names). Never invent sensor readings."""


def build_farm_prompt(context: CopilotContext) -> str:
    parts: list[str] = [
        f"FARM: {context.farm.name} ({context.farm.location_name})",
    ]

    if context.forecast is not None:
        c = context.forecast.current
        parts.append(
            "WEATHER NOW: "
            f"{c.temperature}C, {c.summary}, humidity {c.humidity}%, "
            f"wind {c.wind_speed} km/h, source={c.source}"
        )
        for day in context.forecast.daily[:3]:
            parts.append(
                f"FORECAST {day.date:%Y-%m-%d}: {day.summary}, "
                f"{day.temperature_min}-{day.temperature_max}C, "
                f"rain {day.precipitation_sum_mm}mm"
            )

    for field_obj, bundle in context.fields:
        h = bundle["health"]
        cond = bundle["conditions"]
        irr = bundle["irrigation"]
        yf = bundle["yield_forecast"]
        scan = bundle.get("latest_disease_scan")

        lines = [
            f"FIELD {field_obj.name}: crop={field_obj.crop.name if field_obj.crop else 'none'}, "
            f"stage={cond['growth_stage']}, area={field_obj.area_hectares:.1f}ha",
            f"  health={h['health_score']}/100 ({h['health_status']}), "
            f"change_7d={h.get('change_7d')}",
            f"  soil_moisture={cond['soil_moisture']}%, target={irr['target_moisture_min']}"
            f"-{irr['target_moisture_max']}%",
            f"  irrigation={irr['recommendation']}"
            + (f" (within {irr['urgency_hours']}h)" if irr["urgency_hours"] else ""),
            f"  water_needed={irr['water_needed_mm']}mm, disease_pressure={cond['disease_risk']}/100",
        ]
        if "error" not in yf:
            lines.append(
                f"  yield_forecast={yf['expected_yield_t_per_ha']} t/ha "
                f"({yf['min_yield_t_per_ha']}-{yf['max_yield_t_per_ha']})"
            )
        if scan:
            lines.append(
                f"  last_scan={scan['disease']} ({scan['confidence']}% conf, "
                f"{scan['severity']})"
            )
        parts.append("\n".join(lines))

    open_alerts = [a for a in context.alerts if not a.is_resolved]
    for alert in open_alerts[:10]:
        parts.append(f"ALERT [{alert.severity}] {alert.title}: {alert.message}")

    return "\n\n".join(parts)


async def llm_answer(question: str, context: CopilotContext) -> CopilotAnswer:
    """Call the LLM; on any failure, gracefully fall back to rules."""
    if not settings.openai_api_key:
        return answer_question(question, context)

    payload = {
        "model": settings.openai_model,
        "temperature": 0.3,
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"FARM DATA:\n{build_farm_prompt(context)}\n\nQUESTION: {question}",
            },
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{settings.openai_base_url.rstrip('/')}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            reply = data["choices"][0]["message"]["content"].strip()
    except Exception:
        logger.warning("LLM copilot failed — falling back to rules engine.", exc_info=True)
        return answer_question(question, context)

    return CopilotAnswer(
        reply=reply,
        intent="llm",
        data_sources=[{"kind": "field", "label": "all fields"}],
        suggested_questions=SUGGESTIONS,
    )
