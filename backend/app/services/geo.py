"""Geodesic helpers for field boundaries (GeoJSON rings: [lng, lat])."""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6378137.0  # WGS84 equatorial radius

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
