"""Serverless function entrypoint for the Vercel Python runtime.

vercel.json routes every request to this function, and the runtime preserves
the original request path, so the FastAPI app's /api/... routes match
unchanged (no app code is modified for deployment).

Serverless notes:
- The function filesystem is read-only except /tmp, so the SQLite database
  lives at /tmp/terramind.db (configured via the DATABASE_URL env var).
- /tmp is ephemeral: each new instance starts empty, so the demo data is
  re-seeded below on every cold start (seed() is idempotent).
- The PyTorch disease model cannot ship in a serverless bundle; it is
  disabled via DISEASE_MODEL_ENABLED and the disease API degrades to a
  clear 503 "model_unavailable" response.
"""

import os
import sys
from pathlib import Path

# This file lives at <project-root>/api/index.py — put the project root
# (the backend/ directory) on sys.path so the `app` package resolves.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Safety net: the PyTorch disease model cannot run in a serverless bundle.
os.environ.setdefault("DISEASE_MODEL_ENABLED", "false")

from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

# Cold start: create tables + demo data (no-op when already present).
seed()
