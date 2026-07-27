"use client";

/*
  ProgressBar — thin "% watched" bar. Shared by ProgressPosterCard
  (Home "Jump back in") and the Continue Watching bar so the progress
  affordance reads identically everywhere.
*/

interface ProgressBarProps {
  /** 0–100. Clamped. */
  pct: number;
  className?: string;
}

export default function ProgressBar({ pct, className = "" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`h-1 w-full overflow-hidden rounded-full ${className}`}
      style={{ background: "rgba(255,255,255,0.16)" }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, background: "var(--cta-primary)" }}
      />
    </div>
  );
}
