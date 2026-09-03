"use client";

/** Irrigation — water plans driven by live weather and soil conditions. */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CloudRain, Droplets, Gauge, Timer } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { HourlyForecastChart } from "@/components/charts";
import { Badge, SimulatedBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { formatNumber } from "@/lib/format";
import type { FarmIrrigation, IrrigationAdvice, WeatherForecast } from "@/lib/types";

function recTone(rec: string): "rain" | "harvest" | "sprout" {
  if (rec === "irrigate") return "rain";
  if (rec === "monitor") return "harvest";
  return "sprout";
}

/** Moisture bar with the crop's optimal band highlighted. */
function MoistureGauge({ advice }: { advice: IrrigationAdvice }) {
  const band = Math.min(
    100,
    Math.max(0, advice.target_moisture_max - advice.target_moisture_min),
  );
  const bandLeft = Math.min(95, Math.max(0, advice.target_moisture_min));

  return (
    <div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-canopy-900">
        <div
          className="absolute inset-y-0 bg-sprout-500/25"
          style={{ left: `${bandLeft}%`, width: `${band}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-rain-400"
          style={{ width: `${Math.min(100, Math.max(0, advice.soil_moisture))}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-moss-500">
        <span>Target {advice.target_moisture_min}–{advice.target_moisture_max}%</span>
        <span
          className={`tm-num font-semibold ${
            advice.soil_moisture < advice.target_moisture_min
              ? "text-blaze-300"
              : "text-moss-300"
          }`}
        >
          Now {Math.round(advice.soil_moisture)}%
        </span>
      </div>
    </div>
  );
}

function AdviceCard({ advice }: { advice: IrrigationAdvice }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/fields/${advice.field_id}`}
            className="truncate text-sm font-semibold text-moss-50 hover:text-sprout-300"
          >
            {advice.field_name}
          </Link>
          <p className="mt-0.5 text-xs leading-relaxed text-moss-400">
            {advice.headline}
          </p>
        </div>
        <Badge tone={recTone(advice.recommendation)}>{advice.recommendation}</Badge>
      </div>

      <div className="mt-4">
        <MoistureGauge advice={advice} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-canopy-900/70 p-2.5">
          <p className="tm-num text-sm font-semibold text-rain-300">
            {advice.water_needed_mm > 0
              ? advice.water_needed_mm.toFixed(1)
              : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-moss-500">
            mm needed
          </p>
        </div>
        <div className="rounded-xl bg-canopy-900/70 p-2.5">
          <p className="tm-num text-sm font-semibold text-moss-50">
            {advice.estimated_volume_m3 > 0
              ? Math.round(advice.estimated_volume_m3)
              : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-moss-500">
            m³ water
          </p>
        </div>
        <div className="rounded-xl bg-canopy-900/70 p-2.5">
          <p className="tm-num text-sm font-semibold text-moss-50">
            {advice.urgency_hours ?? "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-moss-500">
            urgency (h)
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {advice.reasons.map((reason, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-moss-300">
            <span className="text-sprout-400">•</span>
            {reason}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function IrrigationPage() {
  const { farmId } = useFarm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["irrigation", farmId],
    queryFn: () => api<FarmIrrigation>(`/api/v1/irrigation/farms/${farmId}`),
    enabled: farmId !== null,
    staleTime: 60_000,
  });

  const { data: weather } = useQuery({
    queryKey: ["weather", farmId],
    queryFn: () => api<WeatherForecast>(`/api/v1/weather/farms/${farmId}`),
    enabled: farmId !== null,
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Irrigation" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState message={(error as Error).message} retry={() => refetch()} />
    );
  }

  const recs = data?.recommendations ?? [];
  const toIrrigate = recs.filter((r) => r.recommendation === "irrigate");
  const toMonitor = recs.filter((r) => r.recommendation === "monitor");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Irrigation"
        description={data?.summary ?? "Water plans driven by live weather and soil conditions."}
        actions={<SimulatedBadge />}
      />

      {recs.length === 0 ? (
        <EmptyState
          icon={<Droplets className="h-6 w-6" />}
          title="No irrigation data"
          description="Add fields with crops to receive irrigation recommendations."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Water today"
              value={
                data!.total_estimated_volume_m3 > 0
                  ? Math.round(data!.total_estimated_volume_m3)
                  : 0
              }
              unit="m³"
              icon={<Droplets className="h-4 w-4" />}
              tone="rain"
              hint={`Across ${toIrrigate.length + toMonitor.length} fields`}
            />
            <StatTile
              label="Irrigate now"
              value={toIrrigate.length}
              icon={<CloudRain className="h-4 w-4" />}
              tone={toIrrigate.length > 0 ? "blaze" : "sprout"}
              hint={
                toIrrigate.length > 0
                  ? toIrrigate.map((r) => r.field_name).join(", ")
                  : "Nothing needs water right now"
              }
            />
            <StatTile
              label="Monitor"
              value={toMonitor.length}
              icon={<Timer className="h-4 w-4" />}
              tone="harvest"
              hint="Approaching target band edges"
            />
          </div>

          {/* Rain outlook */}
          {weather ? (
            <Card>
              <CardHeader
                title="48-hour rain & temperature outlook"
                subtitle="Rainfall is credited at 70% effectiveness against each field's water deficit."
                action={
                  <span className="flex items-center gap-1.5 text-xs text-moss-400">
                    <Gauge className="h-3.5 w-3.5 text-rain-400" />
                    {weather.current.source === "open_meteo"
                      ? "Open-Meteo live"
                      : "Simulated"}
                  </span>
                }
              />
              <HourlyForecastChart hours={weather.hourly.slice(0, 48)} height={220} />
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {recs.map((advice) => (
              <AdviceCard key={advice.field_id} advice={advice} />
            ))}
          </div>

          <p className="text-xs leading-relaxed text-moss-500">
            Recommendations assume a 300 mm root zone. Water volumes scale with
            field area —{" "}
            {formatNumber(recs.reduce((sum, r) => sum + r.estimated_volume_m3, 0), 0)}{" "}
            m³ total if every field were irrigated today.
          </p>
        </>
      )}
    </div>
  );
}
