import type { ReactNode } from "react";

import { Droplets, HeartPulse, Sprout, TrendingUp } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: HeartPulse,
    title: "Explainable crop health",
    text: "Live field scores with the exact factors behind every point.",
  },
  {
    icon: Sprout,
    title: "AI disease detection",
    text: "Computer-vision scanning for 38 crop diseases, in seconds.",
  },
  {
    icon: Droplets,
    title: "Irrigation intelligence",
    text: "Water plans driven by live weather and soil conditions.",
  },
  {
    icon: TrendingUp,
    title: "Yield forecasting",
    text: "Season projections with confidence intervals and trends.",
  },
];

/** Split-screen visual used by login & register pages. */
export function AuthPanel({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="tm-bg-glow grid min-h-screen lg:grid-cols-2">
      {/* Left — marketing panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-canopy-700/60 bg-canopy-900/60 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sprout-500 to-sprout-700 text-canopy-950">
            <Sprout className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-moss-50">
            Terra<span className="text-sprout-400">Mind</span>
          </span>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-moss-50">
            Your farm&apos;s
            <br />
            <span className="text-sprout-400">digital twin,</span> in real time.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-moss-300">
            TerraMind fuses weather, soil and crop intelligence into one
            command center — predicting stress before it costs you yield.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-canopy-600/50 bg-canopy-850/60 p-4"
              >
                <item.icon className="h-5 w-5 text-sprout-400" />
                <p className="mt-2.5 text-sm font-medium text-moss-100">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-moss-400">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-moss-500">
          Precision agriculture intelligence · Lahore, Punjab
        </p>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sprout-500 to-sprout-700 text-canopy-950">
              <Sprout className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-moss-50">
              Terra<span className="text-sprout-400">Mind</span>
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-moss-50">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-moss-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-blaze-400/30 bg-blaze-400/10 px-3.5 py-2.5 text-sm text-blaze-300">
      {message}
    </div>
  );
}

export const inputClassName =
  "h-11 w-full rounded-xl border border-canopy-600/70 bg-canopy-850/80 px-3.5 text-sm text-moss-100 placeholder:text-moss-500 focus:border-sprout-500 focus:outline-none focus:ring-2 focus:ring-sprout-500/20";
