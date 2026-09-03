"use client";

/** Overview — the farm intelligence dashboard. */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CloudSun,
  Droplets,
  Layers,
  Leaf,
  MapPin,
  Sparkles,
  Sprout,
  Wind,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge, SimulatedBadge, StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { formatNumber, formatTemp, relativeTime, riskTone, signed } from "@/lib/format";
import type { OverviewFieldCard, OverviewPayload } from "@/lib/types";

function FieldCard({ field }: { field: OverviewFieldCard }) {
  return (
    <Link
      href={`/fields/${field.id}`}
      className="group block rounded-2xl border border-canopy-600/50 bg-canopy-850/70 p-5 transition-colors hover:border-sprout-500/40 hover:bg-canopy-800/80"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-moss-50">
            {field.name}
          </p>
          <p className="mt-0.5 text-xs text-moss-400">
            {field.crop ?? "No crop"}
            {field.variety ? ` · ${field.variety}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="moss">{field.growth_stage}</Badge>
            <Badge
              tone={
                field.irrigation_recommendation === "irrigate"
                  ? "rain"
                  : field.irrigation_recommendation === "monitor"
                    ? "harvest"
                    : "sprout"
              }
            >
              <Droplets className="h-3 w-3" />
              {field.irrigation_recommendation === "irrigate"
                ? "Irrigate"
                : field.irrigation_recommendation === "monitor"
                  ? "Monitor water"
                  : "No irrigation"}
            </Badge>
            <Badge tone={riskTone(field.risk_level)}>
              {field.risk_level} risk
            </Badge>
          </div>
        </div>
        <ScoreRing score={field.health_score} size={72} strokeWidth={6} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-canopy-700/60 pt-3 text-center">
        <div>
          <p className="tm-num text-sm font-semibold text-rain-300">
            {Math.round(field.soil_moisture)}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-moss-500">
            Soil moisture
          </p>
        </div>
        <div>
          <p
            className={`tm-num text-sm font-semibold ${
              field.disease_risk >= 60
                ? "text-blaze-300"
                : field.disease_risk >= 40
                  ? "text-harvest-300"
                  : "text-sprout-300"
            }`}
          >
            {Math.round(field.disease_risk)}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-moss-500">
            Disease risk
          </p>
        </div>
        <div>
          <p
            className={`tm-num text-sm font-semibold ${
              field.health_change_7d === null
                ? "text-moss-300"
                : field.health_change_7d >= 0
                  ? "text-sprout-300"
                  : "text-blaze-300"
            }`}
          >
            {signed(field.health_change_7d, 0)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-moss-500">
            7-day change
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function OverviewPage() {
  const { farm, farmId } = useFarm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["overview", farmId],
    queryFn: () => api<OverviewPayload>(`/api/v1/farms/${farmId}/overview`),
    enabled: farmId !== null,
    staleTime: 60_000,
  });

  if (farm === null && !isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          description="Your farm intelligence dashboard."
        />
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title="No farms yet"
          description="Create your first farm in Settings to unlock the digital twin, health intelligence and the AI copilot."
          action={
            <Link href="/settings">
              <Button size="sm">Create a farm</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const weather = data?.weather;
  const current = weather?.current;
  const top = data?.top_recommendation;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={
          farm
            ? `${farm.name} — ${farm.location_name || "your farm"} at a glance.`
            : "Your farm intelligence dashboard."
        }
        actions={
          current ? (
            <div className="flex items-center gap-3 rounded-xl border border-canopy-600/60 bg-canopy-850/80 px-3.5 py-2">
              <CloudSun className="h-5 w-5 text-harvest-400" />
              <div>
                <p className="tm-num text-sm font-semibold text-moss-50">
                  {formatTemp(current.temperature)}
                </p>
                <p className="text-[10px] text-moss-400">{current.summary}</p>
              </div>
              <div className="hidden border-l border-canopy-700 pl-3 sm:block">
                <p className="tm-num text-xs text-moss-200">
                  {Math.round(current.humidity)}% RH
                </p>
                <p className="tm-num text-[10px] text-moss-400">
                  {Math.round(current.wind_speed)} km/h
                </p>
              </div>
            </div>
          ) : null
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          message={(error as Error).message}
          retry={() => refetch()}
        />
      ) : data ? (
        <>
          {/* Stat tiles */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Farm health"
              value={Math.round(data.farm_health.average_score ?? 0)}
              unit="/ 100"
              icon={<Leaf className="h-4 w-4" />}
              tone="sprout"
              hint={`Across ${data.farm_health.field_count} fields`}
            />
            <StatTile
              label="Active alerts"
              value={data.alerts.open_count}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone={data.alerts.critical_count > 0 ? "blaze" : "harvest"}
              hint={
                data.alerts.critical_count > 0
                  ? `${data.alerts.critical_count} critical`
                  : "No critical alerts"
              }
            />
            <StatTile
              label="Total area"
              value={formatNumber(data.farm_health.total_area_hectares)}
              unit="ha"
              icon={<Layers className="h-4 w-4" />}
              tone="moss"
              hint={`${data.fields.length} active fields`}
            />
            <StatTile
              label="Weather now"
              value={formatTemp(current?.temperature)}
              icon={<Wind className="h-4 w-4" />}
              tone="rain"
              hint={
                current
                  ? `${current.summary} · rain ${Math.round(current.rain_probability)}%`
                  : undefined
              }
            />
          </div>

          {/* Top recommendation */}
          {top ? (
            <Card className="border-sprout-500/30 bg-gradient-to-r from-sprout-500/10 via-canopy-850/80 to-canopy-850/80">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sprout-500/15 text-sprout-400">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-sprout-300">
                      Priority action · {top.field_name}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-moss-50">
                      {top.title}
                    </p>
                    <p className="mt-0.5 text-xs text-moss-300">
                      {top.action}
                    </p>
                  </div>
                </div>
                <Link
                  href="/alerts"
                  className="shrink-0"
                >
                  <Button variant="secondary" size="sm">
                    Review alerts
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          ) : null}

          {/* Field cards */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-moss-50">
                Fields
              </h2>
              <Link
                href="/digital-twin"
                className="flex items-center gap-1 text-xs font-medium text-sprout-400 hover:text-sprout-300"
              >
                Open digital twin
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {data.fields.length === 0 ? (
              <EmptyState
                icon={<Layers className="h-6 w-6" />}
                title="No fields yet"
                description="Add fields with their boundaries to start tracking health, irrigation and yield."
                action={
                  <Link href="/fields">
                    <Button size="sm">Add a field</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                {data.fields.map((field) => (
                  <FieldCard key={field.id} field={field} />
                ))}
              </div>
            )}
          </div>

          {/* Latest alerts */}
          <Card>
            <CardHeader
              title="Latest alerts"
              subtitle="Derived live from field conditions, weather and disease scans."
              action={
                <Link
                  href="/alerts"
                  className="text-xs font-medium text-sprout-400 hover:text-sprout-300"
                >
                  View all
                </Link>
              }
            />
            {data.alerts.latest.length === 0 ? (
              <p className="py-6 text-center text-sm text-moss-400">
                No open alerts — your farm is in good shape.
              </p>
            ) : (
              <ul className="divide-y divide-canopy-700/60">
                {data.alerts.latest.slice(0, 4).map((alert) => (
                  <li key={alert.id} className="flex items-start gap-3 py-3">
                    <span className="mt-1">
                      <StatusDot
                        tone={
                          alert.severity === "critical"
                            ? "blaze"
                            : alert.severity === "warning"
                              ? "harvest"
                              : "rain"
                        }
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-moss-100">
                        {alert.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-moss-400">
                        {alert.message}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-moss-500">
                      {relativeTime(alert.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Data provenance */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-moss-500">
            <MapPin className="h-3.5 w-3.5" />
            {farm?.location_name || "Farm"} ·
            <span className="text-moss-400">
              Weather:{" "}
              {data.data_sources.weather === "open_meteo"
                ? "Open-Meteo (live)"
                : "simulated"}
            </span>
            ·
            {data.data_sources.telemetry === "sensor" ? (
              <span className="text-moss-400">Telemetry: field sensors</span>
            ) : (
              <SimulatedBadge />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
