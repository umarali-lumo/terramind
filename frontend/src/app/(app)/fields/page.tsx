"use client";

/** Fields — list + create (with boundary drawing). */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, MapPinned, Plus, RotateCcw, X } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { DrawMapView } from "@/components/map/MapView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { formatDate, formatNumber, healthTone } from "@/lib/format";
import type { Crop, Field, Ring } from "@/lib/types";

const SOIL_TYPES = [
  "Loam",
  "Clay Loam",
  "Sandy Loam",
  "Silt Loam",
  "Clay",
  "Sandy",
  "Saline",
];

const inputClass =
  "h-10 w-full rounded-xl border border-canopy-600/70 bg-canopy-900/70 px-3 text-sm text-moss-100 placeholder:text-moss-500 focus:border-sprout-500 focus:outline-none focus:ring-2 focus:ring-sprout-500/20";

const labelClass = "mb-1.5 block text-xs font-medium text-moss-300";

function CreateFieldPanel({ onClose }: { onClose: () => void }) {
  const { farm, farmId } = useFarm();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [cropId, setCropId] = useState<string>("");
  const [variety, setVariety] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [soilType, setSoilType] = useState("Loam");
  const [soilPh, setSoilPh] = useState("7.0");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: cropData } = useQuery({
    queryKey: ["crops"],
    queryFn: () => api<{ crops: Crop[] }>("/api/v1/crops"),
    staleTime: Infinity,
  });

  const createField = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<Field>("/api/v1/fields", {
        method: "POST",
        query: { farm_id: farmId },
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields", farmId] });
      queryClient.invalidateQueries({ queryKey: ["overview", farmId] });
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not create field.");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    createField.mutate({
      name: name.trim(),
      crop_id: cropId ? Number(cropId) : null,
      variety: variety.trim(),
      planting_date: plantingDate || null,
      soil_type: soilType,
      soil_ph: Number(soilPh),
      boundary: points.length >= 3 ? points : null,
    });
  }

  return (
    <Card className="mb-6 border-sprout-500/30">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-moss-50">Add a new field</h2>
          <p className="mt-0.5 text-xs text-moss-400">
            Draw the boundary on the map (click to add points) and fill in the
            crop details.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-moss-400 hover:bg-canopy-700 hover:text-moss-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          <DrawMapView
            center={
              farm
                ? { lat: farm.latitude, lng: farm.longitude }
                : { lat: 31.45, lng: 74.23 }
            }
            points={points}
            onAddPoint={(lng, lat) =>
              setPoints((prev) => [...prev, [lng, lat]])
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-moss-400">
            <span className="flex items-center gap-1.5">
              <MapPinned className="h-3.5 w-3.5 text-sprout-400" />
              {points.length} point{points.length === 1 ? "" : "s"}
              {points.length >= 3
                ? " — boundary ready"
                : ` — ${Math.max(0, 3 - points.length)} more to close`}
            </span>
            {points.length > 0 ? (
              <button
                onClick={() => setPoints([])}
                className="flex items-center gap-1 text-moss-300 hover:text-moss-100"
              >
                <RotateCcw className="h-3 w-3" />
                Clear drawing
              </button>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5">
          {error ? (
            <div className="rounded-xl border border-blaze-400/30 bg-blaze-400/10 px-3 py-2 text-xs text-blaze-300">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="fieldName" className={labelClass}>
              Field name
            </label>
            <input
              id="fieldName"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="North Tomato Block"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="crop" className={labelClass}>
              Crop
            </label>
            <select
              id="crop"
              value={cropId}
              onChange={(e) => setCropId(e.target.value)}
              className={inputClass}
            >
              <option value="">No crop yet</option>
              {(cropData?.crops ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.category})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="variety" className={labelClass}>
              Variety (optional)
            </label>
            <input
              id="variety"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              placeholder="Roma VF"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="planting" className={labelClass}>
                Planting date
              </label>
              <input
                id="planting"
                type="date"
                value={plantingDate}
                onChange={(e) => setPlantingDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="soilPh" className={labelClass}>
                Soil pH
              </label>
              <input
                id="soilPh"
                type="number"
                min={0}
                max={14}
                step={0.1}
                value={soilPh}
                onChange={(e) => setSoilPh(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="soil" className={labelClass}>
              Soil type
            </label>
            <select
              id="soil"
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className={inputClass}
            >
              {SOIL_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            loading={createField.isPending}
            className="w-full"
          >
            Create field
          </Button>
          <p className="text-[11px] leading-relaxed text-moss-500">
            The boundary is optional — without it the field is placed at the
            farm center with 0 ha until you draw one.
          </p>
        </form>
      </div>
    </Card>
  );
}

export default function FieldsPage() {
  const { farmId } = useFarm();
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["fields", farmId],
    queryFn: () =>
      api<{ fields: Field[] }>("/api/v1/fields", { query: { farm_id: farmId! } }),
    enabled: farmId !== null,
    staleTime: 30_000,
  });

  const fields = data?.fields ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fields"
        description="Every field with its live health score, crop and growth stage."
        actions={
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Add field
          </Button>
        }
      />

      {creating ? <CreateFieldPanel onClose={() => setCreating(false)} /> : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={3} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={(error as Error).message} retry={() => refetch()} />
      ) : fields.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="No fields yet"
          description="Create your first field — draw its boundary on the map and TerraMind starts tracking health, irrigation and yield immediately."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add field
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {fields.map((field) => {
            const tone = healthTone(field.health_score);
            return (
              <Link
                key={field.id}
                href={`/fields/${field.id}`}
                className="group rounded-2xl border border-canopy-600/50 bg-canopy-850/70 p-5 transition-colors hover:border-sprout-500/40 hover:bg-canopy-800/80"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-moss-50">
                      {field.name}
                    </p>
                    <p className="mt-0.5 text-xs text-moss-400">
                      {field.crop?.name ?? "No crop"}
                      {field.variety ? ` · ${field.variety}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={tone}>{field.health_status ?? "Unknown"}</Badge>
                      <Badge tone="moss">{field.growth_stage}</Badge>
                    </div>
                  </div>
                  {field.health_score !== null ? (
                    <ScoreRing score={field.health_score} size={64} strokeWidth={5} />
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-canopy-700/60 pt-3 text-center text-xs">
                  <div>
                    <p className="tm-num font-semibold text-moss-100">
                      {formatNumber(field.area_hectares)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-moss-500">
                      Hectares
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-moss-100">
                      {field.soil_type}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-moss-500">
                      Soil · pH {field.soil_ph}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-moss-100">
                      {field.planting_date
                        ? formatDate(field.planting_date)
                        : "—"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-moss-500">
                      Planted
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
