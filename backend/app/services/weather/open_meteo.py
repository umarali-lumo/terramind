"""Open-Meteo weather provider (real data, no API key required)."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

import httpx

from app.core.config import get_settings
from app.schemas.weather import CurrentWeather, ForecastDay, ForecastHour
from app.services.weather.base import WeatherProvider, summarize_code

logger = logging.getLogger("terramind.weather")

settings = get_settings()


class OpenMeteoProvider(WeatherProvider):
    name = "open_meteo"

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)

    async def get_weather(
        self,
        latitude: float,
        longitude: float,
    ) -> tuple[CurrentWeather, list[ForecastHour], list[ForecastDay]]:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": ",".join(
                [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "apparent_temperature",
                    "is_day",
                    "precipitation",
                    "weather_code",
                    "wind_speed_10m",
                ]
            ),
            "hourly": ",".join(
                [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "precipitation",
                    "precipitation_probability",
                    "weather_code",
                    "uv_index",
                ]
            ),
            "daily": ",".join(
                [
                    "weather_code",
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_sum",
                    "precipitation_probability_max",
                    "wind_speed_10m_max",
                ]
            ),
            "past_days": 3,
            "forecast_days": 7,
            "timezone": "auto",
        }

        response = await self._client.get(
            settings.open_meteo_base_url,
            params=params,
        )
        response.raise_for_status()
        payload = response.json()

        current = self._parse_current(payload)
        hourly = self._parse_hourly(payload)
        daily = self._parse_daily(payload)
        return current, hourly, daily

    def _parse_current(self, payload: dict) -> CurrentWeather:
        c = payload["current"]
        now = datetime.now(UTC)
        is_day = bool(c.get("is_day", 1))
        return CurrentWeather(
            temperature=round(float(c["temperature_2m"]), 1),
            apparent_temperature=round(float(c["apparent_temperature"]), 1),
            humidity=round(float(c["relative_humidity_2m"]), 0),
            wind_speed=round(float(c["wind_speed_10m"]), 1),
            precipitation_mm=round(float(c.get("precipitation", 0.0)), 1),
            rain_probability=0.0,  # filled from hourly below
            uv_index=0.0,
            weather_code=int(c.get("weather_code", 0)),
            summary=summarize_code(int(c.get("weather_code", 0)), is_day),
            is_day=is_day,
            observed_at=now,
            source="open_meteo",
        )

    def _parse_hourly(self, payload: dict) -> list[ForecastHour]:
        h = payload.get("hourly", {})
        times = h.get("time", [])
        now = datetime.now(UTC).timestamp()
        result: list[ForecastHour] = []
        for i, raw in enumerate(times):
            ts = datetime.fromisoformat(raw).replace(tzinfo=UTC)
            if ts.timestamp() < now - 3600:
                continue  # keep future hours only
            result.append(
                ForecastHour(
                    time=ts,
                    temperature=round(float(h["temperature_2m"][i]), 1),
                    precipitation_mm=round(float(h.get("precipitation", [0] * len(times))[i]), 1),
                    rain_probability=round(
                        float(h.get("precipitation_probability", [0] * len(times))[i]), 0
                    ),
                    humidity=round(float(h["relative_humidity_2m"][i]), 0),
                )
            )
            if len(result) >= 72:
                break
        return result

    def _parse_daily(self, payload: dict) -> list[ForecastDay]:
        d = payload.get("daily", {})
        result: list[ForecastDay] = []
        for i, raw in enumerate(d.get("time", [])):
            ts = datetime.fromisoformat(raw).replace(tzinfo=UTC)
            code = int(d.get("weather_code", [0] * len(d["time"]))[i])
            result.append(
                ForecastDay(
                    date=ts,
                    temperature_max=round(float(d["temperature_2m_max"][i]), 1),
                    temperature_min=round(float(d["temperature_2m_min"][i]), 1),
                    precipitation_sum_mm=round(float(d.get("precipitation_sum", [0.0])[i]), 1),
                    rain_probability_max=round(
                        float(d.get("precipitation_probability_max", [0.0])[i]), 0
                    ),
                    wind_speed_max=round(float(d.get("wind_speed_10m_max", [0.0])[i]), 1),
                    summary=summarize_code(code),
                    weather_code=code,
                )
            )
        return result


async def run_with_timeout(coro, seconds: float = 8.0):  # noqa: ANN001
    return await asyncio.wait_for(coro, timeout=seconds)
