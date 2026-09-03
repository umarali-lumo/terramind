"use client";

/** Disease Detection — AI leaf scanning workflow + history. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FlaskConical,
  ImagePlus,
  Loader2,
  ScanSearch,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { PredictionBars } from "@/components/charts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { api, ApiError, API_BASE, getToken } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { relativeTime, riskTone } from "@/lib/format";
import type {
  DiseaseModelStatus,
  DiseaseScan,
  DiseaseScan as ScanType,
  Field,
} from "@/lib/types";

/** Scan thumbnails require the auth header — fetch as blob and object-URL it. */
function ScanImage({ scan, className = "" }: { scan: ScanType; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!scan.image_url) {
      setFailed(true);
      return;
    }

    fetch(`${API_BASE}${scan.image_url}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("no image");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scan.image_url]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-canopy-900/80 text-moss-500 ${className}`}
      >
        <FlaskConical className="h-5 w-5" />
      </div>
    );
  }
  if (!url) {
    return <div className={`animate-pulse bg-canopy-800/70 ${className}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={`Scan of ${scan.detected_crop}`} className={`object-cover ${className}`} />;
}

function ModelStatusBanner() {
  const { data: model } = useQuery({
    queryKey: ["disease-model"],
    queryFn: () => api<DiseaseModelStatus>("/api/v1/disease/model"),
    refetchInterval: (query) =>
      query.state.data?.loaded ? false : 5_000,
  });

  if (!model) return null;

  if (!model.loaded) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-harvest-400/25 bg-harvest-400/5 px-4 py-3 text-sm text-harvest-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          AI model warming up ({model.model_name}) — scans will be available in
          a moment.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sprout-500/25 bg-sprout-500/5 px-4 py-3 text-sm text-sprout-300">
      <CheckCircle2 className="h-4 w-4" />
      <span>
        Model ready — {model.model_name} on {model.device}. Trained on 38
        crop-disease classes (PlantVillage).
      </span>
    </div>
  );
}

export default function DiseasePage() {
  const { farmId } = useFarm();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: fieldsData } = useQuery({
    queryKey: ["fields", farmId],
    queryFn: () =>
      api<{ fields: Field[] }>("/api/v1/fields", { query: { farm_id: farmId! } }),
    enabled: farmId !== null,
    staleTime: 60_000,
  });

  const { data: history, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["disease-scans"],
    queryFn: () => api<{ scans: DiseaseScan[] }>("/api/v1/disease/scans"),
    staleTime: 30_000,
  });

  const selectFile = useCallback((f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }, [preview]);

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a leaf image first.");
      const form = new FormData();
      form.append("file", file);
      return api<DiseaseScan>("/api/v1/disease/scan", {
        method: "POST",
        query: fieldId ? { field_id: Number(fieldId) } : undefined,
        formData: form,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disease-scans"] });
      if (farmId !== null) {
        queryClient.invalidateQueries({ queryKey: ["overview", farmId] });
      }
    },
  });

  const result = scanMutation.data ?? null;
  const scanError =
    scanMutation.error instanceof ApiError || scanMutation.error instanceof Error
      ? scanMutation.error.message
      : null;

  const scans = history?.scans ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disease Detection"
        description="Upload a leaf photo — the vision model identifies the crop and disease from 38 classes, with severity and a treatment plan."
      />

      <ModelStatusBanner />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Upload workflow */}
        <Card>
          <CardHeader
            title="New scan"
            subtitle="JPEG or PNG up to 10 MB. A clear, well-lit leaf photo gives the best results."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scanMutation.mutate();
            }}
            className="space-y-4"
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f && f.type.startsWith("image/")) selectFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging
                  ? "border-sprout-400 bg-sprout-500/10"
                  : "border-canopy-600 bg-canopy-900/50 hover:border-canopy-500"
              }`}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Selected leaf"
                  className="max-h-48 rounded-xl object-contain"
                />
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-moss-400" />
                  <p className="mt-3 text-sm font-medium text-moss-200">
                    Drop a leaf photo here
                  </p>
                  <p className="mt-1 text-xs text-moss-500">
                    or click to browse
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-canopy-600/70 bg-canopy-900/70 px-3 text-sm text-moss-100 focus:border-sprout-500 focus:outline-none"
              >
                <option value="">Not linked to a field</option>
                {(fieldsData?.fields ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                loading={scanMutation.isPending}
                disabled={!file}
                className="sm:w-40"
              >
                <ScanSearch className="h-4 w-4" />
                Analyze leaf
              </Button>
            </div>

            {scanError ? (
              <div className="rounded-xl border border-blaze-400/30 bg-blaze-400/10 px-3 py-2 text-xs text-blaze-300">
                {scanError}
              </div>
            ) : null}
          </form>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader
            title="Result"
            subtitle={
              result
                ? `${result.detected_crop} · ${relativeTime(result.created_at)}`
                : "Run a scan to see the diagnosis here."
            }
          />
          {!result ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-canopy-600 bg-canopy-900/40 py-14 text-center">
              <UploadCloud className="h-8 w-8 text-moss-500" />
              <p className="mt-3 text-sm text-moss-400">
                Diagnosis appears here after a scan
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`tm-num text-3xl font-semibold ${
                    result.is_healthy ? "text-sprout-300" : "text-blaze-300"
                  }`}
                >
                  {result.is_healthy ? "Healthy" : result.disease}
                </span>
                <Badge tone={result.is_healthy ? "sprout" : riskTone("high")}>
                  {result.confidence.toFixed(1)}% confidence
                </Badge>
                {!result.is_healthy ? (
                  <Badge tone="harvest">Severity: {result.severity}</Badge>
                ) : null}
              </div>

              {result.recommended_action ? (
                <div className="rounded-xl bg-canopy-900/70 px-4 py-3 text-sm leading-relaxed text-moss-200">
                  <span className="font-medium text-sprout-300">
                    Treatment plan:{" "}
                  </span>
                  {result.recommended_action}
                </div>
              ) : (
                <div className="rounded-xl bg-sprout-500/5 px-4 py-3 text-sm text-moss-200">
                  No disease detected — keep monitoring weekly.
                </div>
              )}

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-moss-500">
                  Top predictions
                </p>
                <PredictionBars predictions={result.top_predictions} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader
          title="Scan history"
          subtitle="Every scan is stored with its image, prediction and treatment plan."
        />
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} rows={2} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={(error as Error).message} retry={() => refetch()} />
        ) : scans.length === 0 ? (
          <EmptyState
            icon={<ScanSearch className="h-6 w-6" />}
            title="No scans yet"
            description="Upload your first leaf photo to build a field health record."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="overflow-hidden rounded-2xl border border-canopy-600/50 bg-canopy-900/50"
              >
                <div className="flex gap-3 p-3">
                  <ScanImage
                    scan={scan}
                    className="h-20 w-20 shrink-0 rounded-xl border border-canopy-700"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`truncate text-sm font-semibold ${
                          scan.is_healthy ? "text-sprout-300" : "text-moss-50"
                        }`}
                      >
                        {scan.is_healthy ? "Healthy" : scan.disease}
                      </p>
                      <span className="shrink-0 text-[10px] text-moss-500">
                        {relativeTime(scan.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-moss-400">
                      {scan.detected_crop}
                      {scan.field_name ? ` · ${scan.field_name}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge
                        tone={
                          scan.is_healthy
                            ? "sprout"
                            : scan.severity === "high"
                              ? "blaze"
                              : "harvest"
                        }
                      >
                        {scan.confidence.toFixed(0)}% · {scan.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {scans.length > 0 ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-moss-500">
            <Trash2 className="h-3 w-3" />
            Scans without thumbnails are historical seed records (image not
            stored).
          </p>
        ) : null}
      </Card>
    </div>
  );
}
