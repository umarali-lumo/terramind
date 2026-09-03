"use client";

/** Settings — profile, farm management and platform information. */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  FlaskConical,
  Globe,
  Leaf,
  Loader2,
  LogOut,
  MapPin,
  Trash2,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFarm } from "@/lib/farm";
import { formatDate, formatNumber } from "@/lib/format";
import type { Farm } from "@/lib/types";

const inputClass =
  "h-10 w-full rounded-xl border border-canopy-600/70 bg-canopy-900/70 px-3 text-sm text-moss-100 placeholder:text-moss-500 focus:border-sprout-500 focus:outline-none focus:ring-2 focus:ring-sprout-500/20";

const labelClass = "mb-1.5 block text-xs font-medium text-moss-300";

interface GeocodeResult {
  name: string;
  admin1: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  label: string;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Location input with live place search (Open-Meteo geocoding via the API). */
function LocationSearch({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: GeocodeResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const debounced = useDebounced(value.trim(), 350);
  const searchable = debounced.length >= 2 && debounced !== selected;

  const { data, isFetching } = useQuery({
    queryKey: ["geocode", debounced],
    queryFn: () =>
      api<{ results: GeocodeResult[] }>("/api/v1/farms/geocode", {
        query: { q: debounced },
      }),
    enabled: searchable,
    staleTime: 300_000,
  });

  const results = searchable ? (data?.results ?? []) : [];

  function handleSelect(place: GeocodeResult) {
    setSelected(place.label);
    onChange(place.label);
    onSelect(place);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        id="farmLocation"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSelected(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Search a place — e.g. Karachi"
        className={inputClass}
      />
      {open && searchable ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-canopy-600/70 bg-canopy-900 shadow-xl shadow-black/40">
          {isFetching ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-moss-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching places…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-moss-400">
              No matching places — try another name.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {results.map((place) => (
                <li key={`${place.label}-${place.latitude}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(place)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-canopy-800"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sprout-400" />
                    <span>
                      <span className="font-medium text-moss-100">{place.name}</span>
                      <span className="block text-moss-400">
                        {[place.admin1, place.country].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CreateFarmForm() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setFarmId } = useFarm();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState("31.4500");
  const [lng, setLng] = useState("74.2300");
  const [error, setError] = useState<string | null>(null);

  const createFarm = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<Farm>("/api/v1/farms", { method: "POST", body: payload }),
    onSuccess: (farm) => {
      // Register the new farm in the cache before switching to it, so the
      // farm selector (and New Field) point at the farm that was just created
      // even while the list refetch is still in flight.
      queryClient.setQueryData(
        ["farms", user?.id],
        (old: { farms: Farm[] } | undefined) =>
          old ? { farms: [...old.farms, farm] } : { farms: [farm] },
      );
      setFarmId(farm.id);
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      setName("");
      setLocation("");
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not create farm."),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    createFarm.mutate({
      name: name.trim(),
      location_name: location.trim(),
      latitude: Number(lat),
      longitude: Number(lng),
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      {error ? (
        <div className="rounded-xl border border-blaze-400/30 bg-blaze-400/10 px-3 py-2 text-xs text-blaze-300">
          {error}
        </div>
      ) : null}
      <div>
        <label htmlFor="farmName" className={labelClass}>
          Farm name
        </label>
        <input
          id="farmName"
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Green Valley Farm"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="farmLocation" className={labelClass}>
          Location
        </label>
        <LocationSearch
          value={location}
          onChange={setLocation}
          onSelect={(place) => {
            setLocation(place.label);
            setLat(String(place.latitude));
            setLng(String(place.longitude));
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="farmLat" className={labelClass}>
            Latitude
          </label>
          <input
            id="farmLat"
            type="number"
            step="any"
            required
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="farmLng" className={labelClass}>
            Longitude
          </label>
          <input
            id="farmLng"
            type="number"
            step="any"
            required
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <Button type="submit" loading={createFarm.isPending} className="w-full">
        Create farm
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { farms, farm, setFarmId } = useFarm();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const deleteFarm = useMutation({
    mutationFn: (farmId: number) =>
      api(`/api/v1/farms/${farmId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      setConfirmDelete(null);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your account, farms and how TerraMind sources its data."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" subtitle="Your TerraMind identity." />
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-canopy-600 to-canopy-700 text-lg font-semibold text-moss-100 ring-1 ring-canopy-500/60">
              {(user?.full_name ?? "?")
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-moss-50">
                {user?.full_name}
                {user?.is_demo ? <Badge tone="earth">Demo account</Badge> : null}
              </p>
              <p className="mt-0.5 text-xs text-moss-400">{user?.email}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-canopy-700/60 pt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </Card>

        {/* Data sources */}
        <Card>
          <CardHeader
            title="Data sources"
            subtitle="Where every number in TerraMind comes from."
          />
          <ul className="space-y-3.5">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rain-400/10 text-rain-400">
                <Globe className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-moss-100">
                  Weather — Open-Meteo
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-moss-400">
                  Live current conditions, 48-hour and 7-day forecasts. Falls
                  back to a deterministic simulation when offline.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sprout-500/10 text-sprout-400">
                <FlaskConical className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-moss-100">
                  Disease AI — ResNet-50 (Hugging Face)
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-moss-400">
                  <code className="text-moss-300">
                    mesabo/agri-plant-disease-resnet50
                  </code>{" "}
                  — 38 crop-disease classes trained on PlantVillage imagery.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-earth-400/10 text-earth-300">
                <Leaf className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-moss-100">
                  Field telemetry — simulated until hardware ships
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-moss-400">
                  Deterministic per-field conditions biased by live weather.
                  Always labelled “Simulated” — never presented as sensor data.
                </p>
              </div>
            </li>
          </ul>
        </Card>
      </div>

      {/* Farms management */}
      <Card>
        <CardHeader
          title="Farms"
          subtitle={`${farms.length} farm${farms.length === 1 ? "" : "s"} · currently viewing ${farm?.name ?? "—"}.`}
        />
        {farms.length === 0 ? (
          <p className="py-4 text-center text-sm text-moss-400">
            No farms yet — create one on the right.
          </p>
        ) : (
          <ul className="divide-y divide-canopy-700/60">
            {farms.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-canopy-700/60 text-moss-200">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-moss-100">
                    <span className="truncate">{f.name}</span>
                    {f.is_primary ? <Badge tone="sprout">Primary</Badge> : null}
                    {f.id === farm?.id ? (
                      <Badge tone="moss">Active</Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-moss-400">
                    {f.location_name || "—"} · {f.field_count} fields ·{" "}
                    {formatNumber(f.total_area_hectares)} ha · since{" "}
                    {formatDate(f.created_at)}
                  </p>
                </div>
                {f.id !== farm?.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFarmId(f.id)}
                  >
                    Switch to
                  </Button>
                ) : null}
                {confirmDelete === f.id ? (
                  <span className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deleteFarm.isPending}
                      onClick={() => deleteFarm.mutate(f.id)}
                    >
                      Confirm delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(f.id)}
                    aria-label={`Delete ${f.name}`}
                    className="rounded-lg p-1.5 text-moss-500 hover:bg-blaze-400/10 hover:text-blaze-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Add a farm"
            subtitle="Each farm anchors its own weather zone, fields and intelligence."
          />
          <CreateFarmForm />
        </Card>

        <Card>
          <CardHeader
            title="Platform"
            subtitle="TerraMind v2 — production build."
          />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-canopy-900/70 p-3">
              <dt className="text-xs text-moss-400">Frontend</dt>
              <dd className="mt-1 font-medium text-moss-100">
                Next.js · TypeScript · Tailwind
              </dd>
            </div>
            <div className="rounded-xl bg-canopy-900/70 p-3">
              <dt className="text-xs text-moss-400">Backend</dt>
              <dd className="mt-1 font-medium text-moss-100">
                FastAPI · SQLAlchemy · JWT
              </dd>
            </div>
            <div className="rounded-xl bg-canopy-900/70 p-3">
              <dt className="text-xs text-moss-400">AI stack</dt>
              <dd className="mt-1 font-medium text-moss-100">
                ResNet-50 vision · rules copilot
              </dd>
            </div>
            <div className="rounded-xl bg-canopy-900/70 p-3">
              <dt className="text-xs text-moss-400">API docs</dt>
              <dd className="mt-1">
                <a
                  href="http://127.0.0.1:8000/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sprout-400 hover:text-sprout-300"
                >
                  /api/docs (Swagger)
                </a>
              </dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-[11px] text-moss-500">
            <UserRound className="h-3 w-3" />
            Demo account: demo@terramind.ai / terramind123
          </p>
        </Card>
      </div>
    </div>
  );
}
