import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-canopy-700/60 ${className}`}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-canopy-600/50 bg-canopy-850/70 p-5">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i % 2 ? "w-5/6" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-canopy-600 bg-canopy-900/40 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-canopy-700/60 text-moss-300">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-moss-100">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-moss-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  retry,
}: {
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-blaze-400/25 bg-blaze-400/5 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blaze-400/10 text-blaze-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
        >
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-moss-100">{title}</h3>
      {message ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-moss-400">
          {message}
        </p>
      ) : null}
      {retry ? (
        <button
          onClick={retry}
          className="mt-4 rounded-xl border border-canopy-500/60 bg-canopy-700 px-3 py-1.5 text-xs font-medium text-moss-100 hover:bg-canopy-600"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
