"""Weather intelligence schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class CurrentWeather(BaseModel):
    temperature: float
    apparent_temperature: float
    humidity: float
    wind_speed: float
    precipitation_mm: float
    rain_probability: float
    uv_index: float
    weather_code: int
    summary: str
    is_day: bool
    observed_at: datetime
    source: str  # open_meteo | simulated


class ForecastHour(BaseModel):
    time: datetime
    temperature: float
    precipitation_mm: float
    rain_probability: float
    humidity: float


class ForecastDay(BaseModel):
    date: datetime
    temperature_max: float
    temperature_min: float
    precipitation_sum_mm: float
    rain_probability_max: float
    wind_speed_max: float
    summary: str
    weather_code: int


class WeatherForecast(BaseModel):
    farm_id: int
    latitude: float
    longitude: float
    current: CurrentWeather
    hourly: list[ForecastHour]
    daily: list[ForecastDay]
    agriculture_notes: list[str]


class WeatherHistoryPoint(BaseModel):
    time: datetime
    temperature: float
    precipitation_mm: float
    humidity: float


class WeatherResponse(BaseModel):
    forecast: WeatherForecast
    history: list[WeatherHistoryPoint]
