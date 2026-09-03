/** Formatting helpers shared across the UI. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function formatNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatTemp(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}°C`;
}

export function signed(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

/** Health score → semantic color class. */
export function healthTone(score: number | null | undefined) {
  if (score === null || score === undefined) return "moss";
  if (score >= 75) return "sprout";
  if (score >= 55) return "harvest";
  return "blaze";
}

export function severityTone(severity: string) {
  switch (severity) {
    case "critical":
      return "blaze";
    case "warning":
      return "harvest";
    default:
      return "rain";
  }
}

export function riskTone(level: string) {
  if (level === "high") return "blaze";
  if (level === "moderate") return "harvest";
  return "sprout";
}
