"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Menu, Sprout, UserRound } from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFarm } from "@/lib/farm";
import type { AlertList } from "@/lib/types";

function FarmSwitcher() {
  const { farms, farm, setFarmId } = useFarm();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (farms.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-canopy-600/60 bg-canopy-800/80 px-3 py-1.5 text-sm text-moss-100 hover:border-canopy-500"
      >
        <Sprout className="h-4 w-4 text-sprout-400" />
        <span className="max-w-[140px] truncate font-medium sm:max-w-[200px]">
          {farm?.name ?? "Select farm"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-moss-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-canopy-600/70 bg-canopy-850 shadow-2xl">
          <p className="border-b border-canopy-700 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-moss-500">
            Your farms
          </p>
          {farms.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFarmId(f.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-canopy-700/60 ${
                f.id === farm?.id ? "text-sprout-300" : "text-moss-200"
              }`}
            >
              <span className="truncate">{f.name}</span>
              <span className="ml-2 shrink-0 text-[11px] text-moss-400">
                {f.field_count} fields
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AlertsBell() {
  const { farmId } = useFarm();
  const { data } = useQuery({
    queryKey: ["alerts", farmId, "count"],
    queryFn: () =>
      api<AlertList>(`/api/v1/alerts`, { query: { farm_id: farmId! } }),
    enabled: farmId !== null,
    refetchInterval: 60_000,
    select: (d) => d.counts.critical + d.counts.warning,
  });

  const count = data ?? 0;

  return (
    <Link
      href="/alerts"
      aria-label="Alerts"
      className="relative rounded-xl p-2 text-moss-300 hover:bg-canopy-700/60 hover:text-moss-100"
    >
      <Bell className="h-4.5 w-4.5" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blaze-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initials = (user?.full_name ?? user?.email ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-canopy-600 to-canopy-700 text-xs font-semibold text-moss-100 ring-1 ring-canopy-500/60"
      >
        {initials}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-canopy-600/70 bg-canopy-850 shadow-2xl">
          <div className="border-b border-canopy-700 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-moss-100">
              {user?.full_name}
            </p>
            <p className="truncate text-xs text-moss-400">{user?.email}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-moss-200 hover:bg-canopy-700/60"
          >
            <UserRound className="h-4 w-4 text-moss-400" />
            Settings
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              logout();
              router.push("/login");
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-blaze-300 hover:bg-canopy-700/60"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-canopy-700/60 bg-canopy-900/80 px-4 backdrop-blur-md lg:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-xl p-2 text-moss-300 hover:bg-canopy-700/60 hover:text-moss-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <FarmSwitcher />
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <AlertsBell />
        <div className="mx-1 hidden h-6 w-px bg-canopy-700 sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
