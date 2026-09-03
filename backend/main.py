"""TerraMind backend entrypoint: `python backend/main.py`."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the `app` package is importable when launched from repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn  # noqa: E402

from app.main import app  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )
