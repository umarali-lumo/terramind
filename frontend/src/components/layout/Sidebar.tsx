"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Bell,
  CloudSun,
  Droplets,
  HeartPulse,
  Layers,
  LayoutDashboard,
  Map,
  Radio,
  ScanSearch,
  Settings,
  Sparkles,
  Sprout,
  TrendingUp,
  X,
} from "lucide-react";

export const NAV_SECTIONS = [
  {
    title: "Intelligence",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/digital-twin", label: "Digital Twin", icon: Map },
      { href: "/fields", label: "Fields", icon: Layers },
      { href: "/health", label: "Crop Health", icon: HeartPulse },
      { href: "/disease", label: "Disease Detection", icon: ScanSearch },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/irrigation", label: "Irrigation", icon: Droplets },
      { href: "/yield", label: "Yield Forecast", icon: TrendingUp },
      { href: "/weather", label: "Weather", icon: CloudSun },
    ],
  },
  {
    title: "Assistant & Fleet",
    items: [
      { href: "/copilot", label: "AI Copilot", icon: Sparkles },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/iot", label: "IoT Sensors", icon: Radio, soon: true },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-moss-500">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-sprout-500/10 font-medium text-sprout-300"
                        : "text-moss-300 hover:bg-canopy-700/60 hover:text-moss-100"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active
                          ? "text-sprout-400"
                          : "text-moss-400 group-hover:text-moss-200"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.soon ? (
                      <span className="ml-auto rounded-full bg-earth-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-earth-300">
                        Soon
                      </span>
                    ) : null}
                    {active ? (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sprout-400" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sprout-500 to-sprout-700 text-canopy-950 shadow-[0_4px_14px_-4px_rgba(52,208,113,0.5)]">
        <Sprout className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-moss-50">
        Terra<span className="text-sprout-400">Mind</span>
      </span>
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-canopy-900/95">
      <Brand />
      <NavList onNavigate={onNavigate} />
      <div className="border-t border-canopy-700/60 px-5 py-3">
        <p className="text-[10px] leading-relaxed text-moss-500">
          AI-powered digital twin for precision agriculture
        </p>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-canopy-700/60 lg:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-canopy-700/60 transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-5 rounded-lg p-1.5 text-moss-400 hover:bg-canopy-700 hover:text-moss-100"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}
