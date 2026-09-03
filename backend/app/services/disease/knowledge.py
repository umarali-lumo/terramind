"""Disease knowledge base: severity classification & recommended actions."""

from __future__ import annotations

DISEASE_ACTIONS: dict[str, str] = {
    "leaf rust": (
        "Inspect affected plants within 24 hours. Remove severely infected leaves and "
        "consider a fungicide application following local agronomic guidance."
    ),
    "early blight": (
        "Remove and destroy infected lower leaves, improve air circulation, and apply "
        "a protectant fungicide if spread continues."
    ),
    "late blight": (
        "Act immediately — late blight spreads fast. Remove infected plants, avoid "
        "overhead irrigation, and consult local agronomic guidance for treatment."
    ),
    "leaf mold": (
        "Improve greenhouse ventilation and reduce humidity. Remove infected leaves "
        "and apply appropriate treatment if needed."
    ),
    "septoria": (
        "Remove infected lower leaves and avoid working in wet fields to reduce spread. "
        "Apply protectant fungicide if the infection reaches upper canopy."
    ),
    "bacterial spot": (
        "Remove infected plant debris. Avoid overhead watering and apply copper-based "
        "treatments per local guidance."
    ),
    "target spot": (
        "Improve airflow through the canopy and monitor spread. Apply fungicide if "
        "lesions progress above the lower third of the plant."
    ),
    "yellow leaf curl": (
        "Manage whitefly vectors with sticky traps and insect netting. Remove heavily "
        "infected plants — viruses cannot be cured directly."
    ),
    "mosaic virus": (
        "Remove infected plants immediately and control aphid vectors. Disinfect tools "
        "between plants to limit mechanical spread."
    ),
    "spider mites": (
        "Introduce predatory mites or apply miticide during early morning. Increase "
        "humidity to suppress population growth."
    ),
    "powdery mildew": (
        "Improve air circulation and apply sulfur or an appropriate fungicide at first "
        "sign of spread."
    ),
    "downy mildew": (
        "Reduce leaf wetness by watering at the base. Apply a targeted fungicide "
        "following local guidance."
    ),
    "black rot": (
        "Remove infected tissue well below the lesion margin. Sanitize tools and "
        "avoid overhead irrigation."
    ),
}

DEFAULT_ACTION = (
    "Inspect affected plants within 24 hours and consider appropriate treatment "
    "according to local agronomic guidance."
)


def severity_for(disease: str, confidence: float) -> str:
    """Estimate severity from disease type + model confidence."""
    lower = disease.lower()
    if "healthy" in lower:
        return "None"
    severe_diseases = ("late blight", "yellow leaf curl", "mosaic virus", "bacterial wilt")
    if any(name in lower for name in severe_diseases):
        return "Severe" if confidence >= 70 else "Moderate"
    if confidence >= 90:
        return "Moderate"
    if confidence >= 70:
        return "Mild"
    return "Mild"


def recommended_action(disease: str) -> str:
    lower = disease.lower()
    for key, action in DISEASE_ACTIONS.items():
        if key in lower:
            return action
    return DEFAULT_ACTION


def parse_label(label: str) -> dict[str, str]:
    """Split HF labels like `Tomato___Late_blight` into crop + disease."""
    raw = str(label).strip()
    if "___" in raw:
        crop_part, disease_part = raw.split("___", 1)
        crop = crop_part.replace("_", " ").strip()
        disease = disease_part.replace("_", " ").strip()
    else:
        crop = "Unknown"
        disease = raw.replace("_", " ").strip()
    return {"raw": raw, "crop": crop, "disease": disease}


def disease_risk_score(disease: str, confidence: float) -> int:
    """0–100 risk score derived from the detection."""
    lower = disease.lower()
    if "healthy" in lower:
        return max(2, round((100.0 - confidence) * 0.25))
    if confidence >= 90:
        return 85
    if confidence >= 75:
        return 70
    if confidence >= 60:
        return 55
    return 40
