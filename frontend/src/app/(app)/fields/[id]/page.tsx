"use client";

/** Field detail — full intelligence bundle for one field. */

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CloudSun,
  Droplets,
  FlaskConical,
  HeartPulse,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { ConditionsTrendChart, HealthTrendChart } from "@/components/charts";
import { Badge, SimulatedBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { StatTile } from "@/components/ui/StatTile";
import { ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import {
  formatDate,
  formatNumber,
  formatTemp,
  relativeTime,
  riskTone,
  signed,
} from "@/lib/format";
import type { FieldIntelligence, StressRisk } from "@/lib/types";

function statusTone(status: string): "sprout" | "harvest" | "blaze" | "moss" {
  if (status === "good" || status === "healthy") return "sprout";
  if (status === "fair") return "harvest";
  if (status === "poor" || status === "critical") return "blaze";
  return "moss";
}

function StressCard({ risk }: { risk: StressRisk }) {
  const tone = risk.level === "high" ? "blaze" : risk.level === "moderate" ? "harvest" : "sprout";
  const icons = {
    water: Droplets,
    heat: CloudSun,
    disease: ShieldAlert,
  } as const;
  const Icon = icons[risk.risk_type as keyof typeof icons] ?? ShieldAlert;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              tone === "blaze"
                ? "bg-blaze-400/10 text-blaze-400"
                : tone === "harvest"
                  ? "bg-harvest-400/10 text-harvest-400"
                  : "bg-sprout-500/10 text-sprout-400"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold capitalize text-moss-50">
              {risk.risk_type} stress
            </p>
            <p className="text-xs text-moss-400">
              Next {risk.window_hours}h · {risk.contributing_factors.length} factor
              {risk.contributing_factors.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className={`tm-num text-xl font-semibold ${
              tone === "blaze"
                ? "text-blaze-300"
                : tone === "harvest"
                  ? "text-harvest-300"
                  : "text-sprout-300"
            }`}
          >
            {Math.round(risk.probability)}%
          </p>
          <Badge tone={tone}>{risk.level}</Badge>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-moss-300">
        {risk.prediction}
      </p>
      <p className="mt-2 rounded-xl bg-canopy-900/70 px-3 py-2 text-xs leading-relaxed text-moss-200">
        <span className="font-medium text-sprout-300">Action: </span>
        {risk.recommended_action}
      </p>
    </Card>
  );
}

export default function FieldDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const fieldId = Number(id);
  const [trendMode, setTrendMode] = useState<"health" | "conditions">("health");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["field", fieldId],
    queryFn: () => api<FieldIntelligence>(`/api/v1/fields/${fieldId}`),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-canopy-800" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Field not found"
        message={(error as Error)?.message ?? "This field may have been removed."}
        retry={() => refetch()}
      />
    );
  }

  const { field, conditions, health, irrigation, yield_forecast: yf, latest_disease_scan: scan, weather } = data;

  return (
    <div className="space-y-6">
      <Link
        href="/fields"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-moss-400 hover:text-moss-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All fields
      </Link>

      <PageHeader
        title={field.name}
        description={`${field.crop?.name ?? "No crop"}${field.variety ? ` · ${field.variety}` : ""} · ${field.growth_stage} · ${formatNumber(field.area_hectares)} ha · ${field.soil_type} (pH ${field.soil_ph})`}
        actions={
          <div className="flex items-center gap-2">
            {conditions.source === "simulated" ? <SimulatedBadge /> : null}
            <Link href={`/health`}>
              <span className="rounded-xl border border-canopy-600/60 bg-canopy-850/80 px-3 py-2 text-xs font-medium text-moss-200 hover:border-canopy-500">
                Health deep-dive
              </span>
            </Link>
          </div>
        }
      />

      {/* Live conditions row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Soil moisture"
          value={`${Math.round(conditions.soil_moisture)}%`}
          icon={<Droplets className="h-4 w-4" />}
          tone={
            conditions.water_stress > 60
              ? "blaze"
              : conditions.water_stress > 30
                ? "harvest"
                : "rain"
          }
          hint={`Water stress ${Math.round(conditions.water_stress)}%`}
        />
        <StatTile
          label="Air temperature"
          value={formatTemp(conditions.air_temperature)}
          icon={<CloudSun className="h-4 w-4" />}
          tone="harvest"
          hint={`Soil ${formatTemp(conditions.soil_temperature)}`}
        />
        <StatTile
          label="Disease risk"
          value={`${Math.round(conditions.disease_risk)}%`}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={conditions.disease_risk >= 60 ? "blaze" : "moss"}
          hint={`Humidity ${Math.round(conditions.humidity)}%`}
        />
        <StatTile
          label="Weather now"
          value={formatTemp(weather.temperature)}
          icon={<CloudSun className="h-4 w-4" />}
          tone="rain"
          hint={`${weather.summary} · ${Math.round(weather.rain_probability)}% rain`}
        />
      </div>

      {/* Health + trend */}
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader title="Health score" subtitle={health.summary} />
          <div className="flex items-center gap-5">
            <ScoreRing score={health.health_score} size={112} label={health.health_status} />
            <div className="space-y-2 text-xs">
              <p className="text-moss-400">
                7-day change: {" "}
                <span
                  className={`tm-num font-semibold ${
                    (health.change_7d ?? 0) >= 0 ? "text-sprout-300" : "text-blaze-300"
                  }`}
                >
                  {signed(health.change_7d, 0)}
                </span>
              </p>
              <p className="text-moss-400">
                Season progress: {" "}
                <span className="font-medium text-moss-100">
                  {field.crop && conditions.days_since_planting !== null
                    ? `${Math.min(
                        100,
                        Math.round(
                          (conditions.days_since_planting /
                            field.crop.growth_days) *
                            100,
                        ),
                      )}%`
                    : "—"}
                </span>
              </p>
              <p className="text-moss-400">
                Planted: {" "}
                <span className="font-medium text-moss-100">
                  {formatDate(field.planting_date)}
                  {conditions.days_since_planting !== null
                    ? ` · day ${conditions.days_since_planting}`
                    : ""}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-canopy-700/60 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-moss-500">
              Contributing factors
            </p>
            {health.factors.map((f) => (
              <div key={f.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-moss-300">{f.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-moss-400">{f.value}</span>
                  <Badge tone={statusTone(f.status)}>
                    {f.impact > 0 ? `−${f.impact.toFixed(0)}` : "ok"}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="30-day trend"
            subtitle="Health score, soil moisture and temperature history."
            action={
              <div className="flex gap-1 rounded-xl bg-canopy-900/70 p-1">
                {(["health", "conditions"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTrendMode(mode)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      trendMode === mode
                        ? "bg-canopy-700 text-moss-50"
                        : "text-moss-400 hover:text-moss-100"
                    }`}
                  >
                    {mode === "health" ? "Health" : "Conditions"}
                  </button>
                ))}
              </div>
            }
          />
          {trendMode === "health" ? (
            <HealthTrendChart points={data.health_trend} height={272} />
          ) : (
            <ConditionsTrendChart points={data.health_trend} height={272} />
          )}
        </Card>
      </div>

      {/* Stress risks */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-moss-50">
          <HeartPulse className="h-5 w-5 text-sprout-400" />
          Predicted stress
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {data.stress_risks.map((risk) => (
            <StressCard key={risk.risk_type} risk={risk} />
          ))}
        </div>
      </div>

      {/* Irrigation + Yield + Latest scan */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Irrigation plan"
            subtitle={irrigation.headline}
            action={
              <Badge
                tone={
                  irrigation.recommendation === "irrigate"
                    ? "rain"
                    : irrigation.recommendation === "monitor"
                      ? "harvest"
                      : "sprout"
                }
              >
                {irrigation.recommendation}
              </Badge>
            }
          />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-canopy-900/70 p-3">
              <p className="tm-num text-lg font-semibold text-rain-300">
                {irrigation.water_needed_mm.toFixed(1)}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-moss-500">mm needed</p>
            </div>
            <div className="rounded-xl bg-canopy-900/70 p-3">
              <p className="tm-num text-lg font-semibold text-moss-50">
                {Math.round(irrigation.estimated_volume_m3)}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-moss-500">m³ water</p>
            </div>
            <div className="rounded-xl bg-canopy-900/70 p-3">
              <p className="tm-num text-lg font-semibold text-moss-50">
                {irrigation.urgency_hours ?? "—"}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-moss-500">hours urgency</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {irrigation.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-moss-300">
                <span className="text-sprout-400">•</span>
                {r}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Yield forecast"
            subtitle={`${yf.crop_name} · harvest in ${yf.days_to_harvest ?? "?"} days`}
            action={<Badge tone="moss">{Math.round(yf.confidence)}% confidence</Badge>}
          />
          <div className="flex items-end justify-between">
            <div>
              <p className="tm-num text-3xl font-semibold text-moss-50">
                {formatNumber(yf.expected_yield_t_per_ha, 1)}
                <span className="ml-1 text-xs font-normal text-moss-400">t/ha</span>
              </p>
              <p className="mt-1 text-xs text-moss-400">
                Range {formatNumber(yf.min_yield_t_per_ha, 1)}–
                {formatNumber(yf.max_yield_t_per_ha, 1)} t/ha ·{" "}
                {formatNumber(yf.total_expected_tons, 1)} t total
              </p>
              {yf.trend_percent !== null ? (
                <p className="mt-1 text-xs">
                  <span
                    className={
                      yf.trend_percent >= 0 ? "text-sprout-300" : "text-blaze-300"
                    }
                  >
                    {signed(yf.trend_percent, 0)}% vs last season
                  </span>
                </p>
              ) : null}
            </div>
            <TrendingUp className="h-8 w-8 text-sprout-400/60" />
          </div>
          <div className="mt-4 space-y-1.5 border-t border-canopy-700/60 pt-3">
            {yf.factors.slice(0, 4).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge tone={f.impact === "positive" ? "sprout" : f.impact === "negative" ? "blaze" : "moss"}>
                  {f.impact}
                </Badge>
                <span className="text-moss-300">{f.note}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Latest disease scan */}
      <Card>
        <CardHeader
          title="Latest disease scan"
          subtitle={
            scan
              ? `${scan.detected_crop} · ${relativeTime(scan.created_at)}`
              : "No scans for this field yet."
          }
          action={
            <Link
              href="/disease"
              className="flex items-center gap-1 text-xs font-medium text-sprout-400 hover:text-sprout-300"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Scan a leaf
            </Link>
          }
        />
        {scan ? (
          <div className="flex flex-wrap items-center gap-4">
            <Badge tone={scan.is_healthy ? "sprout" : riskTone("high")}>
              {scan.is_healthy ? "Healthy" : scan.disease}
            </Badge>
            <span className="tm-num text-sm text-moss-200">
              {scan.confidence.toFixed(1)}% confidence
            </span>
            <span className="text-xs text-moss-400">
              Severity: {scan.severity} · Risk {Math.round(scan.disease_risk)}%
            </span>
            {scan.recommended_action ? (
              <p className="w-full rounded-xl bg-canopy-900/70 px-3 py-2 text-xs leading-relaxed text-moss-200">
                {scan.recommended_action}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-moss-400">
            Upload a leaf photo in Disease Detection to check this field.
          </p>
        )}
      </Card>
    </div>
  );
}
