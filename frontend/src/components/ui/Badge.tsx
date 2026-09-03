import type { ReactNode } from "react";

type Tone = "sprout" | "harvest" | "blaze" | "rain" | "moss" | "earth";

const TONES: Record<Tone, string> = {
  sprout: "bg-sprout-500/12 text-sprout-300 border-sprout-500/30",
  harvest: "bg-harvest-400/12 text-harvest-300 border-harvest-400/30",
  blaze: "bg-blaze-400/12 text-blaze-300 border-blaze-400/30",
  rain: "bg-rain-400/12 text-rain-300 border-rain-400/30",
  moss: "bg-moss-400/10 text-moss-300 border-moss-400/25",
  earth: "bg-earth-400/12 text-earth-300 border-earth-400/30",
};

export function Badge({
  tone = "moss",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "moss" }: { tone?: Tone }) {
  const colors: Record<Tone, string> = {
    sprout: "bg-sprout-400",
    harvest: "bg-harvest-400",
    blaze: "bg-blaze-400",
    rain: "bg-rain-400",
    moss: "bg-moss-400",
    earth: "bg-earth-400",
  };
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[tone]}`} />
  );
}

export function SimulatedBadge({ className = "" }: { className?: string }) {
  return (
    <Badge tone="earth" className={className}>
      Simulated data
    </Badge>
  );
}
