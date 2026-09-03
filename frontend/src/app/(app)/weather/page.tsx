"use client";

/** Weather — agri-intelligence view of current + forecast conditions. */

import { useQuery } from "@tanstack/react-query";
import {
  CloudRain,
  CloudSun,
  Droplets,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { HourlyForecastChart } from "@/components/charts";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { formatNumber, formatTemp } from "@/lib/format";
import type { ForecastDay, WeatherForecast } from "@/lib/types";

function dayName(iso: string, index: number): string {
  if (index === 0) return "Today";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
}

function DailyCard({ day, index }: { day: ForecastDay; index: number }) {
  return (
    <div className="flex min-w-[120px] flex-1 flex-col items-center rounded-2xl border border-canopy-600/50 bg-canopy-900/50 p-3">
      <p className="text-xs font-semibold text-moss-100">
        {dayName(day.date, index)}
      </p>
      <p className="mt-1 text-[10px] text-moss-500">{day.summary}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tm-num text-lg font-semibold text-moss-50">
          {Math.round(day.temperature_max)}°
        </span>
        <span className="tm-num text-xs text-moss-400">
          {Math.round(day.temperature_min)}°
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-rain-300">
        <CloudRain className="h-3 w-3" />
        <span className="tm-num">
          {Math.round(day.rain_probability_max)}% ·{" "}
          {day.precipitation_sum_mm.toFixed(1)}mm
        </span>
      </div>
    </div>
  );
}

export default function WeatherPage() {
  const { farm, farmId } = useFarm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["weather", farmId],
    queryFn: () => api<WeatherForecast>(`/api/v1/weather/farms/${farmId}`),
    enabled: farmId !== null,
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Weather" />
        <SkeletonCard rows={4} />
        <SkeletonCard rows={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState message={(error as Error).message} retry={() => refetch()} />
    );
  }

  const current = data?.current;
  const daily = data?.daily ?? [];
  const hourly = data?.hourly ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weather"
        description={`Agri-intelligence for ${farm?.location_name || "your farm"} — conditions, rain outlook and what they mean for your crops.`}
        actions={
          current ? (
            <Badge tone={current.source === "open_meteo" ? "rain" : "earth"}>
              {current.source === "open_meteo"
                ? "Open-Meteo · live"
                : "Simulated (offline mode)"}
            </Badge>
          ) : null
        }
      />

      {current ? (
        <>
          {/* Current hero */}
          <Card className="bg-gradient-to-br from-canopy-800/80 via-canopy-850/80 to-canopy-850/70">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-5">
                <CloudSun className="h-14 w-14 text-harvest-400" />
                <div>
                  <p className="tm-num text-5xl font-semibold tracking-tight text-moss-50">
                    {Math.round(current.temperature)}°
                  </p>
                  <p className="mt-1 text-sm text-moss-300">
                    {current.summary} · feels like{" "}
                    {Math.round(current.apparent_temperature)}°
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
                <div className="rounded-xl bg-canopy-900/60 px-4 py-3 text-center">
                  <Droplets className="mx-auto h-4 w-4 text-rain-400" />
                  <p className="tm-num mt-1.5 text-sm font-semibold text-moss-50">
                    {Math.round(current.humidity)}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-moss-500">
                    Humidity
                  </p>
                </div>
                <div className="rounded-xl bg-canopy-900/60 px-4 py-3 text-center">
                  <Wind className="mx-auto h-4 w-4 text-moss-300" />
                  <p className="tm-num mt-1.5 text-sm font-semibold text-moss-50">
                    {Math.round(current.wind_speed)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-moss-500">
                    km/h wind
                  </p>
                </div>
                <div className="rounded-xl bg-canopy-900/60 px-4 py-3 text-center">
                  <CloudRain className="mx-auto h-4 w-4 text-rain-400" />
                  <p className="tm-num mt-1.5 text-sm font-semibold text-moss-50">
                    {Math.round(current.rain_probability)}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-moss-500">
                    Rain chance
                  </p>
                </div>
                <div className="rounded-xl bg-canopy-900/60 px-4 py-3 text-center">
                  <Sun className="mx-auto h-4 w-4 text-harvest-400" />
                  <p className="tm-num mt-1.5 text-sm font-semibold text-moss-50">
                    {Math.round(current.uv_index)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-moss-500">
                    UV index
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Rain today"
              value={current.precipitation_mm.toFixed(1)}
              unit="mm"
              icon={<CloudRain className="h-4 w-4" />}
              tone="rain"
              hint={`Next rain chance ${Math.round(current.rain_probability)}%`}
            />
            <StatTile
              label="7-day rain total"
              value={formatNumber(
                daily.reduce((s, d) => s + d.precipitation_sum_mm, 0),
                1,
              )}
              unit="mm"
              icon={<CloudRain className="h-4 w-4" />}
              tone="rain"
              hint={`${daily.filter((d) => d.precipitation_sum_mm > 1).length} wet days forecast`}
            />
            <StatTile
              label="Warmest this week"
              value={formatTemp(Math.max(...daily.map((d) => d.temperature_max)))}
              icon={<Thermometer className="h-4 w-4" />}
              tone="harvest"
              hint={`Coolest ${formatTemp(Math.min(...daily.map((d) => d.temperature_min)))}`}
            />
          </div>

          {/* Hourly */}
          <Card>
            <CardHeader
              title="Next 48 hours"
              subtitle="Temperature and rain probability, hour by hour."
            />
            <HourlyForecastChart hours={hourly.slice(0, 48)} height={260} />
          </Card>

          {/* Daily strip */}
          <Card>
            <CardHeader
              title="7-day outlook"
              subtitle="Daily highs, lows and rainfall."
            />
            <div className="flex gap-3 overflow-x-auto pb-1">
              {daily.map((day, i) => (
                <DailyCard key={day.date} day={day} index={i} />
              ))}
            </div>
          </Card>

          {/* Agri notes */}
          <Card>
            <CardHeader
              title="What this means for your crops"
              subtitle="Derived from the forecast and each crop's optimal bands."
            />
            <ul className="space-y-2.5">
              {(data?.agriculture_notes ?? []).map((note, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-moss-200">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sprout-400" />
                  {note}
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
}
