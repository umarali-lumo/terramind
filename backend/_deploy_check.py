"""Verify the backend imports + seeds WITHOUT torch/transformers available.

Simulates the Render free-tier environment (no torch installed) before deploying.
Run from repo root:  .venv/Scripts/python.exe backend/_deploy_check.py
"""

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))

BLOCKED = ("torch", "transformers", "safetensors")


class Blocker:
    """Raise if the app tries to import the AI stack at module load."""

    def find_spec(self, name, path=None, target=None):  # noqa: ANN001
        if name.split(".")[0] in BLOCKED:
            raise ImportError(f"BLOCKED (as if not installed): {name}")
        return None


sys.meta_path.insert(0, Blocker())

print("1. importing app.main with torch/transformers blocked ...")
from app.main import app  # noqa: E402

print("   OK - FastAPI app created:", app.title)

print("2. importing seed module with torch/transformers blocked ...")
import app.seed as seed  # noqa: E402

print("   OK - seed module imported")

print("3. disease classifier behavior with enabled=False ...")
from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()
import os  # noqa: E402

os.environ["DISEASE_MODEL_ENABLED"] = "false"
get_settings.cache_clear()
from app.services.disease import disease_classifier  # noqa: E402

print("   enabled =", disease_classifier.enabled, "-> load_async() no-ops:", end=" ")
disease_classifier.load_async()
print(disease_classifier.loaded is False)

print("\nALL CHECKS PASSED - backend runs without the AI stack installed.")
