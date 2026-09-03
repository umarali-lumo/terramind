"""Weather provider abstraction.

`WeatherProvider` is the seam between TerraMind and real weather services.
`OpenMeteoProvider` uses the free Open-Meteo API (no key required);
`MockWeatherProvider` produces deterministic seasonal conditions so the
platform remains fully functional offline. `WeatherService` selects and
caches results.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.weather import CurrentWeather, ForecastDay, ForecastHour


class WeatherProvider(ABC):
    """Interface implemented by all weather sources."""

    name: str = "base"

    @abstractmethod
    async def get_weather(
        self,
        latitude: float,
        longitude: float,
    ) -> tuple[CurrentWeather, list[ForecastHour], list[ForecastDay]]:
        """Return (current, hourly forecast, daily forecast)."""
        raise NotImplementedError


def summarize_code(code: int, is_day: bool = True) -> str:
    """Map WMO weather codes to short summaries."""
    mapping: dict[int, str] = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snowfall",
        73: "Moderate snowfall",
        75: "Heavy snowfall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return mapping.get(code, "Unknown conditions")
