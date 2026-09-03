"""Deterministic mock weather provider (offline development fallback)."""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

from app.schemas.weather import CurrentWeather, ForecastDay, ForecastHour
from app.services.weather.base import WeatherProvider, summarize_code


def _seeded(seed: int) -> float:
    """Deterministic pseudo-random in [0, 1)."""
    x = math.sin(seed * 12.9898) * 43758.5453
    return x - math.floor(x)


class MockWeatherProvider(WeatherProvider):
    """Seasonal synthetic weather, stable for a given hour & location."""

    name = "simulated"

    async def get_weather(
        self,
        latitude: float,
        longitude: float,
    ) -> tuple[CurrentWeather, list[ForecastHour], list[ForecastDay]]:
        now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
        hour_bucket = int(now.timestamp() // 3600)
        base_seed = hour_bucket + int(latitude * 10) + int(longitude * 10)

        # Monsoon-tail September pattern for South Asia latitudes.
        rain_roll = _seeded(base_seed % 97)
        rainy = rain_roll > 0.72
        code = 63 if rainy and rain_roll > 0.9 else (61 if rainy else (2 if rain_roll > 0.4 else 0))

        temperature = 33 + 4 * math.sin((now.hour - 6) / 24 * 2 * math.pi) + 3 * _seeded(base_seed)
        humidity = (68 if rainy else 48) + 12 * _seeded(base_seed + 1)
        precipitation = round(2.4 * _seeded(base_seed + 2) if rainy else 0.0, 1)

        current = CurrentWeather(
            temperature=round(temperature, 1),
            apparent_temperature=round(temperature + 3.0, 1),
            humidity=round(humidity, 0),
            wind_speed=round(6 + 10 * _seeded(base_seed + 3), 1),
            precipitation_mm=precipitation,
            rain_probability=round(80 if rainy else 15 * _seeded(base_seed + 4), 0),
            uv_index=round(7 * _seeded(base_seed + 5), 1),
            weather_code=code,
            summary=summarize_code(code),
            is_day=(6 <= now.hour <= 18),
            observed_at=now,
            source="simulated",
        )

        hourly: list[ForecastHour] = []
        for offset in range(72):
            ts = now + timedelta(hours=offset)
            seed = base_seed + offset * 7
            day_factor = math.sin((ts.hour - 6) / 24 * 2 * math.pi)
            will_rain = _seeded(seed) > 0.78
            hourly.append(
                ForecastHour(
                    time=ts,
                    temperature=round(31 + 5 * day_factor + 2 * _seeded(seed + 1), 1),
                    precipitation_mm=round(2.2 * _seeded(seed + 2) if will_rain else 0.0, 1),
                    rain_probability=round(75 if will_rain else 10 + 20 * _seeded(seed + 3), 0),
                    humidity=round((66 if will_rain else 45) + 12 * _seeded(seed + 4), 0),
                )
            )

        daily: list[ForecastDay] = []
        for offset in range(7):
            day = (now + timedelta(days=offset)).replace(hour=12)
            seed = base_seed + offset * 131
            rain = _seeded(seed) > 0.6
            day_code = 61 if rain and _seeded(seed + 1) > 0.5 else (80 if rain else 1)
            daily.append(
                ForecastDay(
                    date=day,
                    temperature_max=round(35 + 3 * _seeded(seed + 2), 1),
                    temperature_min=round(23 + 3 * _seeded(seed + 3), 1),
                    precipitation_sum_mm=round(8 * _seeded(seed + 4) if rain else 0.0, 1),
                    rain_probability_max=round(85 if rain else 20, 0),
                    wind_speed_max=round(12 + 14 * _seeded(seed + 5), 1),
                    summary=summarize_code(day_code),
                    weather_code=day_code,
                )
            )

        return current, hourly, daily
