"use client";

/** Crop Health — explainable scores, factor breakdown and trends. */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { ConditionsTrendChart, HealthTrendChart } from "@/components/charts";
import { Badge, SimulatedBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { formatNumber, signed } from "@/lib/format";
import type { HealthAssessment, TrendPoint } from "@/lib/types";

interface FarmHealthResponse {
  farm_id: number;
  average_score: number;
  fields: (HealthAssessment & {
    conditions: Record<string, number | string>;
    data_source: string;
  })[];
}

function factorTone(status: string): "sprout" | "harvest" | "blaze" | "moss" {
  if (status === "good") return "sprout";
  if (status === "fair") return "harvest";
  if (status === "poor" || status === "critical") return "blaze";
  return "moss";
}

export default function HealthPage() {
  const { farmId } = useFarm();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trendMode, setTrendMode] = useState<"health" | "conditions">("health");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["farm-health", farmId],
    queryFn: () => api<FarmHealthResponse>(`/api/v1/health/farms/${farmId}`),
    enabled: farmId !== null,
    staleTime: 60_000,
  });

  const fields = data?.fields ?? [];
  const selected =
    fields.find((f) => f.field_id === selectedId) ?? fields[0] ?? null;

  // Per-field trend (only for the selected field).
  const { data: selectedTrend } = useQuery({
    queryKey: ["field-health", selected?.field_id],
    queryFn: () =>
      api<HealthAssessment & { trend: TrendPoint[] }>(
        `/api/v1/health/fields/${selected!.field_id}`,
      ),
    enabled: selected !== null,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Crop Health" />
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <SkeletonCard rows={5} />
          <SkeletonCard rows={8} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState message={(error as Error).message} retry={() => refetch()} />
    );
  }

  if (fields.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Crop Health" />
        <EmptyState
          icon={<HeartPulse className="h-6 w-6" />}
          title="No health data yet"
          description="Add fields with crops to start tracking explainable health scores."
        />
      </div>
    );
  }

  const trend = selectedTrend?.trend ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crop Health"
        description="Every score is explainable — see exactly which factors helped or hurt each field, with 30-day trends."
        actions={
          selected?.data_source === "simulated" ? <SimulatedBadge /> : null
        }
      />

      {/* Farm average banner */}
      <Card className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <ScoreRing
            score={data!.average_score}
            size={88}
            label="Farm average"
          />
          <div>
            <p className="text-sm font-semibold text-moss-50">
              {fields.length} field{fields.length === 1 ? "" : "s"} assessed
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-moss-400">
              Scores combine soil moisture, temperature, disease pressure, scan
              history and growth-stage sensitivity — recomputed live from
              current weather.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <button
              key={f.field_id}
              onClick={() => setSelectedId(f.field_id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                selected?.field_id === f.field_id
                  ? "border-sprout-500/50 bg-sprout-500/10 text-sprout-300"
                  : "border-canopy-600/50 bg-canopy-900/60 text-moss-300 hover:border-canopy-500"
              }`}
            >
              <span className="font-medium">{f.field_name}</span>
              <span
                className={`tm-num font-semibold ${
                  f.health_score >= 75
                    ? "text-sprout-300"
                    : f.health_score >= 55
                      ? "text-harvest-300"
                      : "text-blaze-300"
                }`}
              >
                {Math.round(f.health_score)}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {selected ? (
        <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
          {/* Score + factors */}
          <Card>
            <CardHeader
              title={selected.field_name}
              subtitle={selected.summary}
              action={
                <Badge
                  tone={
                    selected.health_score >= 75
                      ? "sprout"
                      : selected.health_score >= 55
                        ? "harvest"
                        : "blaze"
                  }
                >
                  {selected.health_status}
                </Badge>
              }
            />
            <div className="flex items-center gap-5">
              <ScoreRing
                score={selected.health_score}
                size={104}
                label="health"
              />
              <div className="space-y-2 text-xs">
                <p className="text-moss-400">
                  7-day change:{" "}
                  <span
                    className={`tm-num font-semibold ${
                      (selected.change_7d ?? 0) >= 0
                        ? "text-sprout-300"
                        : "text-blaze-300"
                    }`}
                  >
                    {signed(selected.change_7d, 0)}
                  </span>
                </p>
                <p className="text-moss-400">
                  Soil moisture:{" "}
                  <span className="font-medium text-rain-300">
                    {formatNumber(Number(selected.conditions.soil_moisture))}%
                  </span>
                </p>
                <p className="text-moss-400">
                  Disease risk:{" "}
                  <span className="font-medium text-moss-100">
                    {formatNumber(Number(selected.conditions.disease_risk))}%
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-canopy-700/60 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-moss-500">
                Factor breakdown
              </p>
              {selected.factors.map((factor) => (
                <div key={factor.name}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-moss-200">{factor.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-moss-400">{factor.value}</span>
                      {factor.impact > 0 ? (
                        <span className="tm-num rounded-full bg-blaze-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-blaze-300">
                          −{factor.impact.toFixed(0)} pts
                        </span>
                      ) : (
                        <span className="rounded-full bg-sprout-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sprout-300">
                          ok
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canopy-900">
                    <div
                      className={`h-full rounded-full ${
                        factorTone(factor.status) === "sprout"
                          ? "bg-sprout-500"
                          : factorTone(factor.status) === "harvest"
                            ? "bg-harvest-400"
                            : "bg-blaze-400"
                      }`}
                      style={{
                        width: `${Math.max(
                          6,
                          Math.min(100, 100 - factor.impact * 3),
                        )}%`,
                      }}
                    />
                  </div>
                  {factor.note ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-moss-500">
                      {factor.note}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          {/* Trend */}
          <Card>
            <CardHeader
              title="30-day history"
              subtitle="How this field arrived at its current score."
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
            {trend.length === 0 ? (
              <p className="py-16 text-center text-sm text-moss-400">
                Loading trend…
              </p>
            ) : trendMode === "health" ? (
              <HealthTrendChart points={trend} height={360} />
            ) : (
              <ConditionsTrendChart points={trend} height={360} />
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
