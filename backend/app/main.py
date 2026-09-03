"""TerraMind FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import engine
from app.core.errors import register_exception_handlers
from app.db.base import Base
from app.services.disease import disease_classifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("terramind")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (SQLite dev flow; use Alembic migrations for production).
    Base.metadata.create_all(bind=engine)
    # Warm up the disease model in the background (non-blocking).
    disease_classifier.load_async()
    logger.info(
        "%s v%s ready — disease model loading in background",
        settings.app_name,
        settings.app_version,
    )
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.app_name} API",
        version=settings.app_version,
        description=(
            "AI-powered digital twin & predictive intelligence platform "
            "for precision agriculture."
        ),
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    @app.get("/api/health", tags=["system"])
    async def health() -> dict:
        """Liveness & model-readiness probe."""
        status = disease_classifier.status()
        return {
            "status": "ok",
            "app": settings.app_name,
            "version": settings.app_version,
            "disease_model": status,
        }

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
