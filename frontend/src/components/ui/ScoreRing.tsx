/** Circular health score indicator. */

const TONE_STROKES: Record<string, string> = {
  sprout: "var(--color-sprout-400)",
  harvest: "var(--color-harvest-400)",
  blaze: "var(--color-blaze-400)",
  moss: "var(--color-moss-400)",
};

export function ScoreRing({
  score,
  size = 96,
  strokeWidth = 8,
  label,
  tone,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  /** Explicit tone override; defaults to score-derived. */
  tone?: "sprout" | "harvest" | "blaze" | "moss";
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const derived =
    clamped >= 75 ? "sprout" : clamped >= 55 ? "harvest" : "blaze";
  const active = tone ?? derived;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-canopy-700)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_STROKES[active]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="tm-num font-semibold text-moss-50"
          style={{ fontSize: size * 0.28 }}
        >
          {Math.round(clamped)}
        </span>
        {label ? (
          <span
            className="text-moss-400"
            style={{ fontSize: Math.max(9, size * 0.1) }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
