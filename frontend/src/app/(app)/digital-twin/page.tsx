"use client";

/** Digital Twin — layered map view of the whole farm. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Layers, Satellite } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { FarmMapView, type MapField } from "@/components/map/MapView";
import { Badge, SimulatedBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { riskTone, signed } from "@/lib/format";
import type { OverviewPayload } from "@/lib/types";

type Layer = "health" | "moisture" | "disease";

const LAYERS: { key: Layer; label: string; description: string }[] = [
  { key: "health", label: "Health", description: "Live crop-health score" },
  { key: "moisture", label: "Soil moisture", description: "Root-zone moisture" },
  { key: "disease", label: "Disease risk", description: "Disease-pressure risk" },
];

function toneForValue(layer: Layer, value: number): MapField["tone"] {
  if (layer === "disease") {
    if (value >= 60) return "blaze";
    if (value >= 40) return "harvest";
    return "sprout";
  }
  if (value >= 75) return "sprout";
  if (value >= 55) return "harvest";
  return "blaze";
}

export default function DigitalTwinPage() {
  const { farm, farmId } = useFarm();
  const [layer, setLayer] = useState<Layer>("health");
  const [basemap, setBasemap] = useState<"dark" | "satellite">("satellite");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["overview", farmId],
    queryFn: () => api<OverviewPayload>(`/api/v1/farms/${farmId}/overview`),
    enabled: farmId !== null,
    staleTime: 60_000,
  });

  const fields: MapField[] = useMemo(() => {
    if (!data) return [];
    return data.fields.map((f) => {
      const value =
        layer === "health"
          ? f.health_score
          : layer === "moisture"
            ? f.soil_moisture
            : f.disease_risk;
      const tone =
        layer === "health"
          ? toneForValue("health", f.health_score)
          : toneForValue(layer, value);
      const detail =
        layer === "health"
          ? `Health ${Math.round(f.health_score)}/100 · ${f.health_status}`
          : layer === "moisture"
            ? `Soil moisture ${Math.round(f.soil_moisture)}%`
            : `Disease risk ${Math.round(f.disease_risk)}% · ${f.risk_level}`;
      return {
        id: f.id,
        name: f.name,
        crop: f.crop,
        variety: f.variety,
        boundary: f.boundary,
        latitude: f.latitude,
        longitude: f.longitude,
        score: value,
        tone,
        detail,
      };
    });
  }, [data, layer]);

  const activeLayer = LAYERS.find((l) => l.key === layer)!;
  const selected = data?.fields.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Twin"
        description={`A live, layered model of ${farm?.name ?? "your farm"}. Switch layers to explore health, moisture and disease pressure.`}
        actions={
          <button
            onClick={() =>
              setBasemap((b) => (b === "dark" ? "satellite" : "dark"))
            }
            className="flex items-center gap-2 rounded-xl border border-canopy-600/60 bg-canopy-850/80 px-3 py-2 text-xs font-medium text-moss-200 hover:border-canopy-500"
          >
            {basemap === "dark" ? (
              <>
                <Satellite className="h-4 w-4 text-rain-400" />
                Satellite view
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 text-sprout-400" />
                Dark view
              </>
            )}
          </button>
        }
      />

      {isLoading ? (
        <div className="h-[520px] animate-pulse rounded-2xl bg-canopy-800/60" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} retry={() => refetch()} />
      ) : !data || data.fields.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="No fields to map"
          description="Add fields with boundaries to bring your digital twin to life."
          action={
            <Link
              href="/fields"
              className="rounded-xl bg-sprout-600 px-3 py-1.5 text-xs font-semibold text-canopy-950"
            >
              Add a field
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {/* Layer switcher */}
            <div className="flex flex-wrap items-center gap-2">
              {LAYERS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setLayer(l.key)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                    layer === l.key
                      ? "bg-sprout-500/15 text-sprout-300 ring-1 ring-sprout-500/40"
                      : "bg-canopy-850/80 text-moss-300 ring-1 ring-canopy-600/50 hover:text-moss-100"
                  }`}
                >
                  {l.label}
                </button>
              ))}
              <span className="ml-1 hidden text-xs text-moss-500 sm:block">
                {activeLayer.description}
              </span>
            </div>

            <FarmMapView
              center={{ lat: data.farm.latitude, lng: data.farm.longitude }}
              fields={fields}
              height={520}
              basemap={basemap}
              onSelect={setSelectedId}
            />

            <div className="flex flex-wrap items-center gap-3 text-xs text-moss-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sprout-400" />
                {layer === "disease" ? "Low" : "Good"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-harvest-400" />
                {layer === "disease" ? "Moderate" : "Fair"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blaze-400" />
                {layer === "disease" ? "High" : "Poor"}
              </span>
              {data.data_sources.telemetry !== "sensor" ? (
                <SimulatedBadge />
              ) : null}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={selected ? selected.name : "Field index"}
                subtitle={
                  selected
                    ? `${selected.crop ?? "No crop"}${selected.variety ? ` · ${selected.variety}` : ""}`
                    : "Select a field on the map or below."
                }
                action={
                  selected ? (
                    <Link
                      href={`/fields/${selected.id}`}
                      className="text-xs font-medium text-sprout-400 hover:text-sprout-300"
                    >
                      Details
                    </Link>
                  ) : null
                }
              />
              {selected ? (
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-moss-400">Health score</dt>
                    <dd className="tm-num font-semibold text-moss-50">
                      {Math.round(selected.health_score)}/100
                      <span className="ml-2 text-xs text-moss-400">
                        {signed(selected.health_change_7d, 0)} 7d
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-moss-400">Growth stage</dt>
                    <dd className="text-moss-100">{selected.growth_stage}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-moss-400">Soil moisture</dt>
                    <dd className="tm-num text-rain-300">
                      {Math.round(selected.soil_moisture)}%
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-moss-400">Disease risk</dt>
                    <dd className="tm-num text-moss-100">
                      {Math.round(selected.disease_risk)}%
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-moss-400">Risk level</dt>
                    <dd>
                      <Badge tone={riskTone(selected.risk_level)}>
                        {selected.risk_level}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs leading-relaxed text-moss-400">
                  Tap any field polygon to inspect its live intelligence, or
                  pick one from the list below.
                </p>
              )}
            </Card>

            <Card padded={false}>
              <p className="border-b border-canopy-700/60 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-moss-400">
                All fields
              </p>
              <ul className="max-h-[320px] divide-y divide-canopy-700/60 overflow-y-auto">
                {data.fields.map((f) => {
                  const value =
                    layer === "health"
                      ? f.health_score
                      : layer === "moisture"
                        ? f.soil_moisture
                        : f.disease_risk;
                  return (
                    <li key={f.id}>
                      <button
                        onClick={() => setSelectedId(f.id)}
                        className={`flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm transition-colors hover:bg-canopy-700/40 ${
                          selectedId === f.id ? "bg-canopy-700/40" : ""
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-moss-100">
                            {f.name}
                          </span>
                          <span className="block truncate text-xs text-moss-500">
                            {f.crop ?? "No crop"} · {f.growth_stage}
                          </span>
                        </span>
                        <span
                          className={`tm-num shrink-0 text-sm font-semibold ${
                            toneForValue(layer, value) === "sprout"
                              ? "text-sprout-300"
                              : toneForValue(layer, value) === "harvest"
                                ? "text-harvest-300"
                                : "text-blaze-300"
                          }`}
                        >
                          {Math.round(value)}
                          {layer === "moisture" || layer === "disease"
                            ? "%"
                            : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
