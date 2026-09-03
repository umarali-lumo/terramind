"use client";

/** Alerts — the farm's attention list with filters and resolve actions. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge, StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { relativeTime } from "@/lib/format";
import type { Alert as AlertType, AlertList } from "@/lib/types";

type Filter = "open" | "critical" | "warning" | "info" | "resolved";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
  { key: "resolved", label: "Resolved" },
];

function severityTone(severity: string): "blaze" | "harvest" | "rain" {
  if (severity === "critical") return "blaze";
  if (severity === "warning") return "harvest";
  return "rain";
}

function AlertRow({
  alert,
  onResolve,
  resolving,
}: {
  alert: AlertType;
  onResolve: (alert: AlertType) => void;
  resolving: boolean;
}) {
  const tone = severityTone(alert.severity);
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start ${
        alert.is_resolved
          ? "border-canopy-700/40 bg-canopy-900/30 opacity-70"
          : tone === "blaze"
            ? "border-blaze-400/25 bg-blaze-400/5"
            : tone === "harvest"
              ? "border-harvest-400/20 bg-harvest-400/5"
              : "border-rain-400/20 bg-rain-400/5"
      }`}
    >
      <span className="mt-1.5 sm:mt-1">
        <StatusDot tone={alert.is_resolved ? "moss" : tone} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-moss-50">
            {alert.is_resolved ? (
              <span className="line-through decoration-moss-500/60">
                {alert.title}
              </span>
            ) : (
              alert.title
            )}
          </p>
          <Badge tone={tone}>{alert.severity}</Badge>
          <Badge tone="moss">{alert.category.replace("_", " ")}</Badge>
          {alert.field_name ? (
            <span className="text-[11px] text-moss-400">{alert.field_name}</span>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-moss-300">
          {alert.message}
        </p>
        {alert.recommended_action ? (
          <p className="mt-2 rounded-xl bg-canopy-900/70 px-3 py-2 text-xs leading-relaxed text-moss-200">
            <span className="font-medium text-sprout-300">Action: </span>
            {alert.recommended_action}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-moss-500">
          {relativeTime(alert.created_at)}
          {alert.is_resolved && alert.resolved_at
            ? ` · resolved ${relativeTime(alert.resolved_at)}`
            : ""}
        </p>
      </div>
      <div className="shrink-0 sm:pl-2">
        {alert.is_resolved ? (
          <Button
            variant="ghost"
            size="sm"
            loading={resolving}
            onClick={() => onResolve(alert)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            loading={resolving}
            onClick={() => onResolve(alert)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolve
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { farmId } = useFarm();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["alerts", farmId, "page"],
    queryFn: () =>
      api<AlertList>("/api/v1/alerts", {
        query: {
          farm_id: farmId!,
          ...(filter === "critical" || filter === "warning" || filter === "info"
            ? { severity: filter }
            : {}),
          ...(filter === "open" || filter === "resolved"
            ? { status_filter: filter }
            : {}),
        },
      }),
    enabled: farmId !== null,
    refetchInterval: 60_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (alert: AlertType) =>
      api<AlertType>(`/api/v1/alerts/${alert.id}`, {
        method: "PATCH",
        body: { is_resolved: !alert.is_resolved },
      }),
    onMutate: (alert) => setResolvingId(alert.id),
    onSettled: () => setResolvingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", farmId] });
    },
  });

  const alerts = data?.alerts ?? [];
  const counts = data?.counts;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Derived live from field conditions, weather and disease scans — refreshed on every load. Resolved alerts stay quiet for 24 hours."
      />

      {/* Summary + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-sprout-500/15 text-sprout-300 ring-1 ring-sprout-500/40"
                  : "bg-canopy-850/80 text-moss-300 ring-1 ring-canopy-600/50 hover:text-moss-100"
              }`}
            >
              {f.label}
              {counts && f.key === "open"
                ? ` (${counts.critical + counts.warning + counts.info})`
                : counts && f.key !== "open"
                  ? ` (${counts[f.key as keyof typeof counts] ?? 0})`
                  : ""}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={(error as Error).message} retry={() => refetch()} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title={
            filter === "resolved"
              ? "Nothing resolved yet"
              : filter === "open"
                ? "All clear"
                : `No ${filter} alerts`
          }
          description={
            filter === "open"
              ? "No open alerts — TerraMind monitors health, water stress, heat, disease pressure and irrigation around the clock."
              : "Try another filter to see different alerts."
          }
        />
      ) : (
        <Card padded>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onResolve={(a) => resolveMutation.mutate(a)}
                resolving={resolvingId === alert.id}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
