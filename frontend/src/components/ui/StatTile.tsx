import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "moss",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "sprout" | "harvest" | "blaze" | "rain" | "moss";
}) {
  const iconTones: Record<string, string> = {
    sprout: "text-sprout-400 bg-sprout-500/10",
    harvest: "text-harvest-400 bg-harvest-400/10",
    blaze: "text-blaze-400 bg-blaze-400/10",
    rain: "text-rain-400 bg-rain-400/10",
    moss: "text-moss-300 bg-moss-400/10",
  };

  return (
    <div className="rounded-2xl border border-canopy-600/50 bg-canopy-850/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-moss-400">
          {label}
        </span>
        {icon ? (
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTones[tone]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tm-num text-2xl font-semibold text-moss-50">
          {value}
        </span>
        {unit ? (
          <span className="text-xs font-medium text-moss-400">{unit}</span>
        ) : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-moss-400">{hint}</div> : null}
    </div>
  );
}
