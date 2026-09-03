"""Weather service: provider selection, caching, agri-intelligence notes."""

from __future__ import annotations

import asyncio
import logging
import time

from app.core.config import get_settings
from app.schemas.weather import (
    CurrentWeather,
    ForecastDay,
    ForecastHour,
    WeatherForecast,
)
from app.services.weather.base import WeatherProvider
from app.services.weather.mock import MockWeatherProvider
from app.services.weather.open_meteo import OpenMeteoProvider

logger = logging.getLogger("terramind.weather")

settings = get_settings()


class WeatherService:
    """Cached facade over weather providers.

    `auto` mode tries Open-Meteo first and falls back to the deterministic
    mock provider when the network is unavailable, keeping the platform
    fully functional offline. The `source` field on every response tells
    the frontend exactly which provider produced the data.
    """

    def __init__(self) -> None:
        self._open_meteo = OpenMeteoProvider()
        self._mock = MockWeatherProvider()
        self._cache: dict[
            tuple[float, float],
            tuple[float, WeatherForecast],
        ] = {}

    def _key(self, latitude: float, longitude: float) -> tuple[float, float]:
        return round(latitude, 3), round(longitude, 3)

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        farm_id: int | None = None,
    ) -> WeatherForecast:
        key = self._key(latitude, longitude)
        now = time.monotonic()

        cached = self._cache.get(key)
        if cached and now - cached[0] < settings.weather_cache_seconds:
            return cached[1]

        mode = settings.weather_provider
        current, hourly, daily = await self._fetch(mode, latitude, longitude)

        forecast = WeatherForecast(
            farm_id=farm_id or 0,
            latitude=latitude,
            longitude=longitude,
            current=current,
            hourly=hourly,
            daily=daily,
            agriculture_notes=build_agriculture_notes(current, hourly, daily),
        )
        self._cache[key] = (now, forecast)
        return forecast

    async def _fetch(
        self,
        mode: str,
        latitude: float,
        longitude: float,
    ) -> tuple[CurrentWeather, list[ForecastHour], list[ForecastDay]]:
        provider: WeatherProvider
        if mode == "mock":
            return await self._mock.get_weather(latitude, longitude)
        if mode == "open_meteo":
            return await self._open_meteo.get_weather(latitude, longitude)

        # auto
        try:
            return await asyncio.wait_for(
                self._open_meteo.get_weather(latitude, longitude),
                timeout=8.0,
            )
        except Exception:
            logger.warning(
                "Open-Meteo unavailable — falling back to simulated weather.",
                exc_info=True,
            )
            return await self._mock.get_weather(latitude, longitude)


def build_agriculture_notes(
    current: CurrentWeather,
    hourly: list[ForecastHour],
    daily: list[ForecastDay],
) -> list[str]:
    """Translate raw forecast into farm-relevant guidance."""
    notes: list[str] = []

    rain_hours = [h for h in hourly[:48] if h.precipitation_mm >= 0.5]
    heavy_days = [d for d in daily[:3] if d.precipitation_sum_mm >= 10]
    hot_hours = [h for h in hourly[:48] if h.temperature >= 37]
    humid_hours = [h for h in hourly[:48] if h.humidity >= 85]

    if rain_hours:
        first = rain_hours[0]
        delta = (first.time.timestamp() - current.observed_at.timestamp()) / 3600
        if delta <= 1:
            notes.append("Rain is starting now — postpone spraying and irrigation.")
        else:
            notes.append(
                f"Rainfall expected in ~{int(delta)} hours "
                f"({first.precipitation_mm:.1f} mm/h). Irrigation demand will drop."
            )
    else:
        notes.append("No significant rainfall in the next 48 hours.")

    if heavy_days:
        d = heavy_days[0]
        notes.append(
            f"Heavy rainfall expected on {d.date.strftime('%A')} "
            f"({d.precipitation_sum_mm:.0f} mm) — plan drainage and avoid field traffic."
        )

    if hot_hours:
        notes.append(
            f"{len(hot_hours)} hours above 37°C in the next 48h — heat and water "
            "stress risk is elevated."
        )

    if len(humid_hours) >= 12:
        notes.append(
            "Sustained humidity above 85% — conditions favour fungal disease "
            "development; monitor leaf canopy closely."
        )

    if current.wind_speed >= 25:
        notes.append("Strong winds now — avoid pesticide application.")

    return notes[:5]


weather_service = WeatherService()
