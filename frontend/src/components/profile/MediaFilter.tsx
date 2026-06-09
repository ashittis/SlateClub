"use client";

import { motion } from "framer-motion";

export type MediaFilterValue = "all" | "movie" | "tv";

const OPTIONS: { key: MediaFilterValue; label: string }[] = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tv", label: "Series" },
];

interface Props {
  value: MediaFilterValue;
  onChange: (v: MediaFilterValue) => void;
  /** Unique layoutId so multiple instances don't share the sliding pill. */
  layoutId?: string;
}

/* All · Movies · Series sub-filter for profile lists (gptplan). */
export default function MediaFilter({ value, onChange, layoutId = "media-filter" }: Props) {
  return (
    <div
      className="inline-flex rounded-full p-1 gap-1"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer"
            style={{ color: active ? "var(--bg-screening)" : "var(--text-muted)" }}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--text-primary)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Filter a list of {mediaType?} items; missing mediaType counts as a film. */
export function filterByMedia<T extends { mediaType?: string | null }>(
  items: T[],
  value: MediaFilterValue,
): T[] {
  if (value === "all") return items;
  return items.filter((i) => (i.mediaType ?? "movie") === value);
}
