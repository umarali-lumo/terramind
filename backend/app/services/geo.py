"""Geodesic helpers for field boundaries (GeoJSON rings: [lng, lat])."""

from __future__ import annotations

import logging
import math

import httpx

logger = logging.getLogger("terramind.geo")

EARTH_RADIUS_M = 6378137.0  # WGS84 equatorial radius

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
_geocoding_client = httpx.AsyncClient(timeout=10.0)


async def search_locations(query: str, count: int = 6) -> list[dict]:
    """Resolve a free-text place query via the Open-Meteo geocoding API.

    Same provider family as the weather service — no API key required.
    Returns [] for short queries and on provider failures, so the Add
    Farm form shows a "no results" state instead of erroring.
    """
    query = query.strip()
    if len(query) < 2:
        return []

    try:
        response = await _geocoding_client.get(
            GEOCODING_URL,
            params={
                "name": query,
                "count": count,
                "language": "en",
                "format": "json",
            },
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Location search failed for %r: %s", query, exc)
        return []

    results: list[dict] = []
    for item in payload.get("results") or []:
        parts = [
            part
            for part in (item.get("name"), item.get("admin1"), item.get("country"))
            if part
        ]
        results.append(
            {
                "name": item.get("name", ""),
                "admin1": item.get("admin1"),
                "country": item.get("country"),
                "latitude": float(item["latitude"]),
                "longitude": float(item["longitude"]),
                "label": ", ".join(parts),
            }
        )
    return results

Ring = list[list[float]]


def ring_centroid(ring: Ring) -> tuple[float, float]:
    """Planar centroid of a ring — adequate for map centering."""
    if not ring:
        return 0.0, 0.0
    lng_sum = sum(p[0] for p in ring)
    lat_sum = sum(p[1] for p in ring)
    n = len(ring)
    return lng_sum / n, lat_sum / n


def ring_area_hectares(ring: Ring) -> float:
    """Geodesic polygon area (spherical excess, turf-style) in hectares."""
    if len(ring) < 3:
        return 0.0

    total = 0.0
    for i in range(len(ring)):
        p1 = ring[i]
        p2 = ring[(i + 1) % len(ring)]
        total += math.radians(p2[0] - p1[0]) * (
            2 + math.sin(math.radians(p1[1])) + math.sin(math.radians(p2[1]))
        )

    area_m2 = abs(total * EARTH_RADIUS_M * EARTH_RADIUS_M / 2.0)
    return round(area_m2 / 10_000.0, 4)


def bbox_of(ring: Ring) -> tuple[float, float, float, float]:
    """(min_lat, min_lng, max_lat, max_lng) of a ring."""
    lats = [p[1] for p in ring]
    lngs = [p[0] for p in ring]
    return min(lats), min(lngs), max(lats), max(lngs)
