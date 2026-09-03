"use client";

/** Yield Forecast — season projections with confidence and trend. */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Scale, Sprout, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { formatDate, formatNumber, signed } from "@/lib/format";
import type { FarmYield, YieldForecast } from "@/lib/types";

/** Horizontal min–expected–max range bar. */
function RangeBar({ forecast }: { forecast: YieldForecast }) {
  const max = Math.max(forecast.max_yield_t_per_ha, 0.1);
  const expectedPct = (forecast.expected_yield_t_per_ha / max) * 100;
  const minPct = (forecast.min_yield_t_per_ha / max) * 100;

  return (
    <div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-canopy-900">
        <div
          className="absolute inset-y-0 rounded-full bg-sprout-500/20"
          style={{ left: `${minPct}%`, width: `${100 - minPct}%` }}
        />
        <div
          className="absolute inset-y-0 w-1 rounded-full bg-sprout-400"
          style={{ left: `calc(${expectedPct}% - 2px)` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-moss-500">
        <span className="tm-num">{formatNumber(forecast.min_yield_t_per_ha, 1)} t/ha</span>
        <span className="tm-num text-sprout-300">
          expected {formatNumber(forecast.expected_yield_t_per_ha, 1)}
        </span>
        <span className="tm-num">{formatNumber(forecast.max_yield_t_per_ha, 1)} t/ha</span>
      </div>
    </div>
  );
}

export default function YieldPage() {
  const { farmId } = useFarm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["yield", farmId],
    queryFn: () => api<FarmYield>(`/api/v1/yield/farms/${farmId}`),
    enabled: farmId !== null,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Yield Forecast" />
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

  const fields = data?.fields ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yield Forecast"
        description="Season projections from live health scores, disease pressure and crop growth stage — with confidence intervals and last-season comparison."
      />

      {fields.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="No forecasts yet"
          description="Add fields with crops and planting dates to generate yield projections."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Expected harvest"
              value={formatNumber(data!.total_expected_tons, 1)}
              unit="t"
              icon={<Scale className="h-4 w-4" />}
              tone="sprout"
              hint={`Across ${formatNumber(data!.total_area_hectares)} ha`}
            />
            <StatTile
              label="Farm average"
              value={formatNumber(data!.average_yield_t_per_ha, 2)}
              unit="t/ha"
              icon={<Sprout className="h-4 w-4" />}
              tone="moss"
            />
            <StatTile
              label="Fields forecast"
              value={fields.length}
              icon={<Sprout className="h-4 w-4" />}
              tone="moss"
              hint={`${fields.filter((f) => f.trend_percent !== null && f.trend_percent >= 0).length} trending up vs last season`}
            />
            <StatTile
              label="Avg confidence"
              value={Math.round(
                fields.reduce((s, f) => s + f.confidence, 0) / fields.length,
              )}
              unit="%"
              icon={<TrendingUp className="h-4 w-4" />}
              tone="harvest"
              hint="Grows as the season progresses"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {fields.map((f) => (
              <Card key={f.field_id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/fields/${f.field_id}`}
                      className="truncate text-sm font-semibold text-moss-50 hover:text-sprout-300"
                    >
                      {f.field_name}
                    </Link>
                    <p className="mt-0.5 text-xs text-moss-400">
                      {f.crop_name} · {formatNumber(f.area_hectares)} ha
                    </p>
                  </div>
                  <Badge tone="moss">{f.confidence}% conf.</Badge>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="tm-num text-2xl font-semibold text-moss-50">
                      {formatNumber(f.expected_yield_t_per_ha, 1)}
                      <span className="ml-1 text-xs font-normal text-moss-400">
                        t/ha
                      </span>
                    </p>
                    <p className="tm-num mt-0.5 text-xs text-moss-400">
                      ≈ {formatNumber(f.total_expected_tons, 1)} t total
                    </p>
                  </div>
                  {f.trend_percent !== null ? (
                    <span
                      className={`tm-num rounded-full px-2 py-0.5 text-xs font-semibold ${
                        f.trend_percent >= 0
                          ? "bg-sprout-500/10 text-sprout-300"
                          : "bg-blaze-400/10 text-blaze-300"
                      }`}
                    >
                      {signed(f.trend_percent, 0)}% vs last season
                    </span>
                  ) : (
                    <span className="text-xs text-moss-500">
                      No history yet
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <RangeBar forecast={f} />
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-canopy-900/70 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 text-moss-300">
                    <CalendarClock className="h-3.5 w-3.5 text-harvest-400" />
                    {f.expected_harvest_date
                      ? formatDate(f.expected_harvest_date)
                      : "—"}
                  </span>
                  <span className="text-moss-400">
                    {f.days_to_harvest !== null
                      ? `${f.days_to_harvest} days to go`
                      : "unknown planting"}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-canopy-700/60 pt-3">
                  {f.factors.map((factor, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span
                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          factor.impact === "positive"
                            ? "bg-sprout-400"
                            : factor.impact === "negative"
                              ? "bg-blaze-400"
                              : "bg-moss-500"
                        }`}
                      />
                      <span className="text-moss-300">{factor.note}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-moss-500">
            Forecasts combine the crop&apos;s base yield with a live health
            factor, growth-stage progress and confirmed disease penalties. As
            the season advances, confidence tightens toward harvest.
          </p>
        </>
      )}
    </div>
  );
}
