"use client";

/** Dynamic (client-only) wrappers — Leaflet cannot render on the server. */

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/feedback";

export type { MapField } from "@/components/map/FarmMap";

export const FarmMapView = dynamic(
  () =>
    import("@/components/map/FarmMap").then((m) => ({
      default: m.FarmMap,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-2xl" />,
  },
);

export const DrawMapView = dynamic(
  () =>
    import("@/components/map/FarmMap").then((m) => ({
      default: m.DrawMap,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[380px] w-full rounded-2xl" />,
  },
);
