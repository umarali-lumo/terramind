"use client";

/** Farm context: the user's farms + the currently selected farm. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Farm } from "@/lib/types";

const FARM_KEY = "terramind.farmId";

interface FarmState {
  farms: Farm[];
  farm: Farm | null;
  farmId: number | null;
  setFarmId: (id: number) => void;
  isLoading: boolean;
}

const FarmContext = createContext<FarmState | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [farmId, setFarmIdState] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["farms", user?.id],
    queryFn: () => api<{ farms: Farm[] }>("/api/v1/farms"),
    enabled: user !== null,
    staleTime: 60_000,
  });

  const farms = useMemo(() => data?.farms ?? [], [data]);

  const setFarmId = useCallback((id: number) => {
    window.localStorage.setItem(FARM_KEY, String(id));
    setFarmIdState(id);
  }, []);

  // Restore the persisted selection on mount.
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(FARM_KEY));
    if (stored) setFarmIdState(stored);
  }, []);

  // Keep the selection valid as the farm list changes.
  useEffect(() => {
    if (farms.length === 0) return;
    if (farmId === null || !farms.some((f) => f.id === farmId)) {
      const fallback = farms.find((f) => f.is_primary) ?? farms[0];
      window.localStorage.setItem(FARM_KEY, String(fallback.id));
      setFarmIdState(fallback.id);
    }
  }, [farms, farmId]);

  const value = useMemo(
    () => ({
      farms,
      farm: farms.find((f) => f.id === farmId) ?? null,
      farmId,
      setFarmId,
      isLoading: isLoading && user !== null,
    }),
    [farms, farmId, setFarmId, isLoading, user],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmState {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used inside <FarmProvider>");
  return ctx;
}
