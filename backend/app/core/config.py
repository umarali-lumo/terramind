"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """TerraMind runtime configuration.

    All values can be overridden through environment variables or a
    `.env` file placed at the repository root. Secrets (JWT secret,
    LLM API keys) must never be hardcoded in source control.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_name: str = "TerraMind"
    app_version: str = "2.0.0"
    debug: bool = True

    # Database. Defaults to a local SQLite file for zero-setup development;
    # point DATABASE_URL at PostgreSQL for production (same relational model).
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'terramind.db').as_posix()}"

    # Authentication
    jwt_secret: str = "terramind-dev-secret-change-me-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Disease detection model (Hugging Face image-classification model)
    disease_model_name: str = "mesabo/agri-plant-disease-resnet50"
    disease_model_enabled: bool = True
    max_image_size_bytes: int = 10 * 1024 * 1024

    # Weather intelligence
    weather_provider: str = "auto"  # auto | open_meteo | mock
    open_meteo_base_url: str = "https://api.open-meteo.com/v1/forecast"
    weather_cache_seconds: int = 900

    # Copilot. "rules" uses the built-in farm-data engine (no external
    # dependency); "openai" uses any OpenAI-compatible chat-completions API.
    copilot_provider: str = "rules"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    # Uploaded scan images
    upload_dir: str = str(BACKEND_DIR / "uploads" / "scans")

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
