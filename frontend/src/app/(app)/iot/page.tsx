"use client";

/** IoT Sensors — coming-soon page with node provisioning + simulated telemetry. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BatteryFull,
  Cpu,
  Radio,
  Signal,
  Trash2,
  Waves,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge, SimulatedBadge, StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { relativeTime } from "@/lib/format";
import type { Field, IoTStatus, SensorNode } from "@/lib/types";

function statusTone(status: string): "sprout" | "harvest" | "earth" {
  if (status === "online") return "sprout";
  if (status === "offline") return "harvest";
  return "earth";
}

export default function IoTPage() {
  const { farmId } = useFarm();
  const queryClient = useQueryClient();

  const [nodeName, setNodeName] = useState("");
  const [nodeField, setNodeField] = useState("");
  const [provisionedKey, setProvisionedKey] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status, isError: statusError } = useQuery({
    queryKey: ["iot-status"],
    queryFn: () => api<IoTStatus>("/api/v1/iot/status"),
  });

  const { data: nodesData, isLoading, isError, error: listError, refetch } =
    useQuery({
      queryKey: ["iot-nodes"],
      queryFn: () => api<{ nodes: SensorNode[] }>("/api/v1/iot/nodes"),
    });

  const { data: fieldsData } = useQuery({
    queryKey: ["fields", farmId],
    queryFn: () =>
      api<{ fields: Field[] }>("/api/v1/fields", { query: { farm_id: farmId! } }),
    enabled: farmId !== null,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["iot-nodes"] });
    queryClient.invalidateQueries({ queryKey: ["iot-status"] });
  };

  const createNode = useMutation({
    mutationFn: (payload: { field_id: number; name: string }) =>
      api<SensorNode>("/api/v1/iot/nodes", { method: "POST", body: payload }),
    onSuccess: (node) => {
      setProvisionedKey(node.device_key ?? null);
      setNodeName("");
      setNodeField("");
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not register node."),
  });

  const simulate = useMutation({
    mutationFn: (nodeId: number) =>
      api(`/api/v1/iot/nodes/${nodeId}/simulate`, {
        method: "POST",
        query: { hours: 24 },
      }),
    onMutate: (nodeId) => setSimulatingId(nodeId),
    onSettled: () => setSimulatingId(null),
    onSuccess: invalidate,
  });

  const removeNode = useMutation({
    mutationFn: (nodeId: number) =>
      api(`/api/v1/iot/nodes/${nodeId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const nodes = nodesData?.nodes ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="IoT Sensors"
        description="TerraMind Field Nodes (ESP32) — hardware in development. Register nodes today and preview the experience with clearly-labelled simulated telemetry."
        actions={
          <Badge tone="harvest">
            <StatusDot tone="harvest" />
            Hardware coming soon
          </Badge>
        }
      />

      {statusError ? (
        <ErrorState message="Could not load IoT status." />
      ) : status ? (
        <Card className="border-harvest-400/25 bg-harvest-400/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-harvest-400/10 text-harvest-400">
              <Radio className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-moss-50">
                Field Node hardware — in development
              </p>
              <p className="mt-1 text-xs leading-relaxed text-moss-300">
                {status.message}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-moss-400">
                <span className="tm-num">
                  <strong className="text-moss-100">{status.node_count}</strong>{" "}
                  node{status.node_count === 1 ? "" : "s"} registered
                </span>
                <span className="tm-num">
                  <strong className="text-moss-100">{status.fields_covered}</strong>{" "}
                  field{status.fields_covered === 1 ? "" : "s"} covered
                </span>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Sensor capabilities */}
      {status ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {status.capabilities.map((cap) => (
            <Card key={cap.sensor}>
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canopy-700/60 text-sprout-400">
                  <Waves className="h-4 w-4" />
                </span>
                <Badge tone="moss">{cap.unit}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-moss-50">
                {cap.sensor}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-moss-400">
                {cap.description}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* Node list */}
        <Card>
          <CardHeader
            title="Registered nodes"
            subtitle="Each node is provisioned with a device ID and secret key for the future ESP32 ingest contract."
          />
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <SkeletonCard key={i} rows={2} />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              message={(listError as Error).message}
              retry={() => refetch()}
            />
          ) : nodes.length === 0 ? (
            <EmptyState
              icon={<Radio className="h-6 w-6" />}
              title="No nodes registered"
              description="Register your first Field Node — you can generate simulated telemetry today and flash the real firmware later."
            />
          ) : (
            <div className="space-y-3">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="rounded-2xl border border-canopy-600/50 bg-canopy-900/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-canopy-700/60 text-moss-200">
                        <Cpu className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-moss-50">
                          {node.name}
                        </p>
                        <p className="tm-num mt-0.5 text-xs text-moss-400">
                          {node.device_id} · {node.field_name ?? "unassigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(node.status)}>{node.status}</Badge>
                      <button
                        onClick={() => removeNode.mutate(node.id)}
                        aria-label="Delete node"
                        className="rounded-lg p-1.5 text-moss-500 hover:bg-blaze-400/10 hover:text-blaze-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-canopy-850/70 p-2.5 text-center">
                      <p className="tm-num text-sm font-semibold text-rain-300">
                        {node.latest_reading
                          ? `${Math.round(node.latest_reading.soil_moisture)}%`
                          : "—"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-moss-500">
                        Moisture
                      </p>
                    </div>
                    <div className="rounded-xl bg-canopy-850/70 p-2.5 text-center">
                      <p className="tm-num text-sm font-semibold text-moss-100">
                        {node.latest_reading
                          ? `${Math.round(node.latest_reading.temperature)}°`
                          : "—"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-moss-500">
                        Temp
                      </p>
                    </div>
                    <div className="rounded-xl bg-canopy-850/70 p-2.5 text-center">
                      <p className="tm-num flex items-center justify-center gap-1 text-sm font-semibold text-moss-100">
                        <BatteryFull className="h-3.5 w-3.5 text-sprout-400" />
                        {node.battery_level !== null
                          ? `${Math.round(node.battery_level)}%`
                          : "—"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-moss-500">
                        Battery
                      </p>
                    </div>
                    <div className="rounded-xl bg-canopy-850/70 p-2.5 text-center">
                      <p className="tm-num flex items-center justify-center gap-1 text-sm font-semibold text-moss-100">
                        <Signal className="h-3.5 w-3.5 text-rain-400" />
                        {node.signal_strength !== null
                          ? `${Math.round(node.signal_strength)}%`
                          : "—"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-moss-500">
                        Signal
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-canopy-700/60 pt-3">
                    <p className="text-[11px] text-moss-500">
                      {node.reading_count} readings
                      {node.latest_reading
                        ? ` · last ${relativeTime(node.latest_reading.recorded_at)}`
                        : ""}
                      {node.latest_reading?.is_simulated ? (
                        <span className="ml-1.5">
                          <SimulatedBadge />
                        </span>
                      ) : null}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={simulatingId === node.id}
                      onClick={() => simulate.mutate(node.id)}
                    >
                      Simulate 24h
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Register node */}
        <Card>
          <CardHeader
            title="Register a node"
            subtitle="Provision a device ID + secret key. The key is shown once — save it for the ESP32 firmware."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!nodeField) {
                setError("Choose a field for this node.");
                return;
              }
              createNode.mutate({
                field_id: Number(nodeField),
                name: nodeName.trim() || `Field Node ${nodes.length + 1}`,
              });
            }}
            className="space-y-3.5"
          >
            {error ? (
              <div className="rounded-xl border border-blaze-400/30 bg-blaze-400/10 px-3 py-2 text-xs text-blaze-300">
                {error}
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-moss-300">
                Field
              </label>
              <select
                value={nodeField}
                onChange={(e) => setNodeField(e.target.value)}
                className="h-10 w-full rounded-xl border border-canopy-600/70 bg-canopy-900/70 px-3 text-sm text-moss-100 focus:border-sprout-500 focus:outline-none"
              >
                <option value="">Select a field…</option>
                {(fieldsData?.fields ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-moss-300">
                Node name (optional)
              </label>
              <input
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                placeholder="Field Node A1"
                className="h-10 w-full rounded-xl border border-canopy-600/70 bg-canopy-900/70 px-3 text-sm text-moss-100 placeholder:text-moss-500 focus:border-sprout-500 focus:outline-none"
              />
            </div>
            <Button type="submit" loading={createNode.isPending} className="w-full">
              Register node
            </Button>
          </form>

          {provisionedKey ? (
            <div className="mt-4 rounded-xl border border-sprout-500/30 bg-sprout-500/5 p-3.5">
              <p className="text-xs font-medium text-sprout-300">
                Device key — shown only once
              </p>
              <code className="tm-num mt-2 block break-all rounded-lg bg-canopy-900 px-3 py-2 text-xs text-moss-100">
                {provisionedKey}
              </code>
              <p className="mt-2 text-[11px] leading-relaxed text-moss-400">
                POST telemetry to{" "}
                <code className="text-moss-200">/api/v1/iot/telemetry/&lt;key&gt;</code>{" "}
                — the exact contract the ESP32 firmware will use.
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
