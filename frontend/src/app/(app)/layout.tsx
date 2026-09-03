"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";

function FullScreenLoader() {
  return (
    <div className="tm-bg-glow flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-sprout-500 border-t-transparent" />
        <p className="text-sm text-moss-400">Loading TerraMind…</p>
      </div>
    </div>
  );
}

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) return <FullScreenLoader />;
  if (user === null) return <FullScreenLoader />;

  return <AppShell>{children}</AppShell>;
}
