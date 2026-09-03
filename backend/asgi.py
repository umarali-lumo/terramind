"""ASGI entrypoint for the Vercel serverless deployment.

Vercel's Python runtime loads the FastAPI instance named ``app`` from the
module configured in pyproject.toml (tool.vercel.entrypoint = "asgi:app").

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

os.environ.setdefault("DISEASE_MODEL_ENABLED", "false")

from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

# Cold start: create tables + demo data (no-op when already present).
seed()
