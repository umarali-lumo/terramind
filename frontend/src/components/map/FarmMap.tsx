"use client";

/** Leaflet map: farm field overlays + polygon drawing (never SSR'd). */

import "leaflet/dist/leaflet.css";
import { useCallback } from "react";
import Link from "next/link";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

import type { Ring } from "@/lib/types";

const TILE_DARK = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

const TILE_SATELLITE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution:
    "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
};

const TONE_COLORS: Record<string, string> = {
  sprout: "#4ade80",
  harvest: "#f5b942",
  blaze: "#f0616d",
  rain: "#5ba8f5",
};

/** Convert GeoJSON [lng, lat] ring to Leaflet [lat, lng] positions. */
function toLatLng(ring: Ring): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

export interface MapField {
  id: number;
  name: string;
  crop: string | null;
  variety?: string | null;
  boundary: Ring | null;
  latitude: number;
  longitude: number;
  /** 0–100 value for the active layer. */
  score: number;
  tone: "sprout" | "harvest" | "blaze" | "rain";
  /** Short description shown in the popup. */
  detail: string;
}

export function FarmMap({
  center,
  fields,
  zoom = 14,
  height = 420,
  basemap = "satellite",
  onSelect,
}: {
  center: { lat: number; lng: number };
  fields: MapField[];
  zoom?: number;
  height?: number;
  basemap?: "dark" | "satellite";
  onSelect?: (fieldId: number) => void;
}) {
  const tile = basemap === "satellite" ? TILE_SATELLITE : TILE_DARK;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-canopy-600/50"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer url={tile.url} attribution={tile.attribution} />

        {fields.map((field) => {
          const color = TONE_COLORS[field.tone];
          const positions = field.boundary
            ? toLatLng(field.boundary)
            : null;

          const popup = (
            <Popup>
              <div className="min-w-[180px] space-y-1.5">
                <p className="text-sm font-semibold">{field.name}</p>
                {field.crop ? (
                  <p className="text-xs opacity-80">
                    {field.crop}
                    {field.variety ? ` · ${field.variety}` : ""}
                  </p>
                ) : null}
                <p className="text-xs">{field.detail}</p>
                {onSelect ? (
                  <button
                    onClick={() => onSelect(field.id)}
                    className="mt-1 rounded-md bg-[#22b45b] px-2.5 py-1 text-xs font-semibold text-[#071811]"
                  >
                    Open details
                  </button>
                ) : (
                  <Link
                    href={`/fields/${field.id}`}
                    className="mt-1 inline-block rounded-md bg-[#22b45b] px-2.5 py-1 text-xs font-semibold text-[#071811]"
                  >
                    Open details
                  </Link>
                )}
              </div>
            </Popup>
          );

          return positions ? (
            <Polygon
              key={field.id}
              positions={positions}
              pathOptions={{
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.28,
              }}
            >
              {popup}
            </Polygon>
          ) : (
            <CircleMarker
              key={field.id}
              center={[field.latitude, field.longitude]}
              radius={16}
              pathOptions={{
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.3,
              }}
            >
              {popup}
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/* ------------------------------------------------------------ drawing */

function ClickCapture({
  onAddPoint,
}: {
  onAddPoint: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onAddPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Interactive map for drawing a field boundary: click to add vertices. */
export function DrawMap({
  center,
  points,
  onAddPoint,
  height = 380,
}: {
  center: { lat: number; lng: number };
  /** Drawn vertices as [lng, lat] (GeoJSON order). */
  points: [number, number][];
  onAddPoint: (lng: number, lat: number) => void;
  height?: number;
}) {
  const handleAdd = useCallback(
    (lat: number, lng: number) => onAddPoint(lng, lat),
    [onAddPoint],
  );

  const positions: [number, number][] = points.map(([lng, lat]) => [lat, lng]);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-canopy-600/50"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer url={TILE_SATELLITE.url} attribution={TILE_SATELLITE.attribution} />
        <ClickCapture onAddPoint={handleAdd} />

        {positions.length > 0 ? (
          <Polyline
            positions={positions}
            pathOptions={{ color: "#4ade80", weight: 2, dashArray: "6 6" }}
          />
        ) : null}
        {positions.map((p, i) => (
          <CircleMarker
            key={i}
            center={p}
            radius={6}
            pathOptions={{
              color: "#4ade80",
              weight: 2,
              fillColor: "#071811",
              fillOpacity: 1,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
