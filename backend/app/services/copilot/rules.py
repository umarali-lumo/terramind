"""TerraMind Copilot — rule-based farm-data engine.

Answers natural-language questions from live farm intelligence without
any external dependency. When an LLM is configured (COPILOT_PROVIDER=
openai), the LLM provider uses the same farm context bundle.
"""

from __future__ import annotations

import re

from app.services.copilot.base import CopilotAnswer, CopilotContext

SUGGESTIONS = [
    "Which field needs attention today?",
    "Should I irrigate any field?",
    "What is the weather outlook?",
    "What is my expected yield?",
    "Any disease detected recently?",
]


def _match(text: str, *keywords: str) -> bool:
    return any(k in text for k in keywords)


def _fmt_change(change: float | None) -> str:
    if change is None:
        return ""
    sign = "+" if change >= 0 else ""
    return f" ({sign}{change:.0f} pts over 7 days)"


def answer_question(question: str, context: CopilotContext) -> CopilotAnswer:
    q = question.lower().strip()
    fields = context.fields
    sources: list[dict] = []
    related: list[int] = []

    if not fields:
        return CopilotAnswer(
            reply=(
                "This farm has no fields yet. Create a field with a crop and "
                "boundary, and I'll start monitoring its health, water and "
                "disease risk."
            ),
            intent="no_data",
            data_sources=[],
            suggested_questions=["How do I add a field?"],
        )

    # ------- Irrigation -------------------------------------------------
    if _match(q, "irrigat", "water", "moisture", "sprinkl", "dry"):
        irrigating = [
            (f, b) for f, b in fields if b["irrigation"]["recommendation"] == "irrigate"
        ]
        monitoring = [
            (f, b) for f, b in fields if b["irrigation"]["recommendation"] == "monitor"
        ]
        lines: list[str] = []

        if irrigating:
            for field, bundle in irrigating:
                irr = bundle["irrigation"]
                lines.append(
                    f"• **{field.name}** — irrigate within {irr['urgency_hours']}h. "
                    f"Moisture {irr['soil_moisture']:.0f}% (target ≥ {irr['target_moisture_min']:.0f}%), "
                    f"need ≈{irr['water_needed_mm']:.0f} mm ({irr['estimated_volume_m3']:.0f} m³)."
                )
                sources.append({"kind": "irrigation", "label": field.name, "ref_id": field.id})
                related.append(field.id)
        if monitoring:
            for field, bundle in monitoring:
                irr = bundle["irrigation"]
                lines.append(
                    f"• **{field.name}** — monitor. Moisture {irr['soil_moisture']:.0f}% is close to "
                    f"the {irr['target_moisture_min']:.0f}% minimum; forecast rain "
                    f"{irr['forecast_rain_mm']:.1f} mm."
                )
                sources.append({"kind": "irrigation", "label": field.name, "ref_id": field.id})
                related.append(field.id)
        if not lines:
            moistures = ", ".join(
                f"{f.name} {b['irrigation']['soil_moisture']:.0f}%" for f, b in fields
            )
            lines.append(
                "No field needs irrigation right now — all soil moisture is inside "
                f"target bands ({moistures})."
            )
        rain_note = ""
        rain_48 = sum(
            max(0.0, h.precipitation_mm)
            for h in (context.forecast.hourly[:48] if context.forecast else [])
        )
        if rain_48 > 4:
            rain_note = f" Note: ~{rain_48:.0f} mm of rain is forecast in the next 48h — plan accordingly."
        return CopilotAnswer(
            reply="Irrigation status:\n\n" + "\n".join(lines) + rain_note,
            intent="irrigation",
            data_sources=sources or [{"kind": "irrigation", "label": "all fields"}],
            suggested_questions=SUGGESTIONS,
        )

    # ------- Disease -----------------------------------------------------
    if _match(q, "disease", "sick", "pest", "fungus", "blight", "rust", "virus", "mildew", "infect"):
        detected = []
        for field, bundle in fields:
            scan = bundle.get("latest_disease_scan")
            if scan and not scan["is_healthy"]:
                detected.append((field, bundle, scan))
        lines = []
        for field, bundle, scan in detected:
            lines.append(
                f"• **{field.name}** — {scan['disease']} detected "
                f"({scan['confidence']:.0f}% confidence, {scan['severity']}). "
                f"{scan['recommended_action']}"
            )
            sources.append({"kind": "scan", "label": field.name, "ref_id": scan["id"]})
            related.append(field.id)
        if not lines:
            lines.append("No diseases detected in recent scans across the farm.")
        risky = [
            (f, b)
            for f, b in fields
            if b["conditions"]["disease_risk"] >= 60
        ]
        if risky:
            risk_txt = ", ".join(
                f"{f.name} ({b['conditions']['disease_risk']:.0f}/100)" for f, b in risky
            )
            lines.append(f"Environmental disease pressure is elevated on: {risk_txt}.")
        return CopilotAnswer(
            reply="Disease report:\n\n" + "\n".join(lines),
            intent="disease",
            data_sources=sources or [{"kind": "field", "label": "all fields"}],
            suggested_questions=SUGGESTIONS,
        )

    # ------- Weather ------------------------------------------------------
    if _match(q, "weather", "rain", "storm", "temperature", "hot", "cold", "forecast", "wind", "humid"):
        current = context.forecast.current if context.forecast else None
        if current is None:
            return CopilotAnswer(
                reply="Weather data is temporarily unavailable.",
                intent="weather",
                data_sources=[],
                suggested_questions=SUGGESTIONS,
            )
        daily = context.forecast.daily[:3]
        lines = [
            f"Currently {current.temperature:.0f}°C, {current.summary.lower()}, "
            f"humidity {current.humidity:.0f}%, wind {current.wind_speed:.0f} km/h."
        ]
        rain_total = sum(d.precipitation_sum_mm for d in daily)
        hot = max(d.temperature_max for d in daily)
        if rain_total > 5:
            lines.append(
                f"≈{rain_total:.0f} mm of rain is expected in the next 3 days — "
                "irrigation demand will drop."
            )
        else:
            lines.append("Little to no rain expected in the next 3 days.")
        if hot >= 37:
            lines.append(f"Peak temperature {hot:.0f}°C — heat stress risk is elevated.")
        if context.forecast.agriculture_notes:
            lines.append(context.forecast.agriculture_notes[0])
        return CopilotAnswer(
            reply=" ".join(lines),
            intent="weather",
            data_sources=[{"kind": "weather", "label": context.farm.name}],
            suggested_questions=SUGGESTIONS,
        )

    # ------- Yield ---------------------------------------------------------
    if _match(q, "yield", "harvest", "production", "tons", "output", "expect"):
        lines = []
        total_tons = 0.0
        for field, bundle in fields:
            yf = bundle["yield_forecast"]
            if "error" in yf:
                continue
            total_tons += yf["total_expected_tons"]
            trend = ""
            if yf.get("trend_percent") is not None:
                sign = "+" if yf["trend_percent"] >= 0 else ""
                trend = f" ({sign}{yf['trend_percent']:.0f}% vs last season)"
            harvest = ""
            if yf.get("expected_harvest_date"):
                harvest = f", harvest expected {yf['expected_harvest_date']}"
            lines.append(
                f"• **{field.name}** — {yf['expected_yield_t_per_ha']:.1f} t/ha "
                f"({yf['min_yield_t_per_ha']:.1f}–{yf['max_yield_t_per_ha']:.1f}), "
                f"{yf['total_expected_tons']:.1f} t total{trend}{harvest}."
            )
            sources.append({"kind": "yield", "label": field.name, "ref_id": field.id})
        if lines:
            lines.append(f"\n**Farm total: ≈{total_tons:.1f} tons** this season.")
        else:
            lines.append("No yield forecasts available — assign crops to your fields first.")
        return CopilotAnswer(
            reply="Yield outlook:\n\n" + "\n".join(lines),
            intent="yield",
            data_sources=sources or [{"kind": "yield", "label": "all fields"}],
            suggested_questions=SUGGESTIONS,
        )

    # ------- Risk / attention -----------------------------------------------
    if _match(q, "risk", "attention", "priority", "alert", "urgent", "wrong", "problem", "today", "first"):
        ranked = sorted(fields, key=lambda fb: fb[1]["health"]["health_score"])
        worst = ranked[:3]
        lines = []
        for field, bundle in worst:
            h = bundle["health"]
            top_factor = next(
                (f for f in h["factors"] if f["impact"] >= 4),
                None,
            )
            factor_txt = (
                f" — main issue: {top_factor['name'].lower()}" if top_factor else ""
            )
            lines.append(
                f"• **{field.name}** — health {h['health_score']:.0f}/100 "
                f"({h['health_status']}){_fmt_change(h.get('change_7d'))}{factor_txt}"
            )
            sources.append({"kind": "field", "label": field.name, "ref_id": field.id})
            related.append(field.id)
        if context.alerts:
            critical = [a for a in context.alerts if a.severity == "critical" and not a.is_resolved]
            if critical:
                lines.append(
                    f"\n{len(critical)} critical alert(s) open — check the Alerts center."
                )
        return CopilotAnswer(
            reply="Fields that need attention, ranked by health score:\n\n" + "\n".join(lines),
            intent="risk",
            data_sources=sources or [{"kind": "field", "label": "all fields"}],
            suggested_questions=SUGGESTIONS,
        )

    # ------- Health -----------------------------------------------------------
    if _match(q, "health", "score", "condition", "status", "how is", "how are"):
        lines = []
        for field, bundle in fields:
            h = bundle["health"]
            lines.append(
                f"• **{field.name}** — {h['health_score']:.0f}/100 ({h['health_status']})"
                f"{_fmt_change(h.get('change_7d'))}"
            )
            sources.append({"kind": "field", "label": field.name, "ref_id": field.id})
        avg = sum(b["health"]["health_score"] for _, b in fields) / len(fields)
        return CopilotAnswer(
            reply=f"Farm average health is {avg:.0f}/100.\n\n" + "\n".join(lines),
            intent="health",
            data_sources=sources,
            suggested_questions=SUGGESTIONS,
        )

    # ------- Sensor/IoT ---------------------------------------------------------
    if _match(q, "sensor", "iot", "esp32", "node", "device"):
        return CopilotAnswer(
            reply=(
                "TerraMind Field Nodes (ESP32 sensors for soil moisture, pH, "
                "temperature and humidity) are coming soon. You can pre-register "
                "nodes on the IoT page and preview the telemetry experience with "
                "clearly-labelled simulated data."
            ),
            intent="iot",
            data_sources=[{"kind": "iot", "label": "sensor ecosystem"}],
            suggested_questions=SUGGESTIONS,
        )

    # ------- Adding field ---------------------------------------------------------
    if _match(q, "add a field", "create a field", "new field", "add field"):
        return CopilotAnswer(
            reply=(
                "Open the Fields page and click \"Add Field\". Draw the boundary on "
                "the map, pick a crop and set the planting date — TerraMind will "
                "immediately start computing health, stress and irrigation intelligence."
            ),
            intent="help",
            data_sources=[],
            suggested_questions=SUGGESTIONS,
        )

    # ------- Fallback: overview -----------------------------------------------------
    avg = sum(b["health"]["health_score"] for _, b in fields) / len(fields)
    needs_irrigation = [
        f.name for f, b in fields if b["irrigation"]["recommendation"] == "irrigate"
    ]
    current = context.forecast.current if context.forecast else None
    lines = [
        f"**{context.farm.name}** overview:",
        f"• {len(fields)} fields, average health {avg:.0f}/100.",
    ]
    if needs_irrigation:
        lines.append(f"• Irrigation recommended for: {', '.join(needs_irrigation)}.")
    if current:
        lines.append(f"• Currently {current.temperature:.0f}°C and {current.summary.lower()}.")
    open_alerts = [a for a in context.alerts if not a.is_resolved]
    if open_alerts:
        lines.append(f"• {len(open_alerts)} open alert(s).")
    lines.append("\nTry asking about irrigation, disease, weather, yield or which field needs attention.")
    return CopilotAnswer(
        reply="\n".join(lines),
        intent="overview",
        data_sources=[{"kind": "field", "label": "all fields"}],
        suggested_questions=SUGGESTIONS,
    )
