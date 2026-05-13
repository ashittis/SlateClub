"use client";

import { motion } from "framer-motion";

export type FeedScope = "all" | "network" | "artists" | "world";

const TABS: Array<{ key: FeedScope; label: string }> = [
  { key: "all", label: "All" },
  { key: "network", label: "Network" },
  { key: "artists", label: "Artists" },
  { key: "world", label: "World" },
];

interface Props {
  value: FeedScope;
  onChange: (s: FeedScope) => void;
}

export default function FeedScopeTabs({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-full p-1 gap-1"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className="relative px-4 py-1.5 text-xs font-semibold rounded-full transition-colors"
            style={{
              color: active ? "var(--bg-screening)" : "var(--text-muted)",
            }}
          >
            {active && (
              <motion.span
                layoutId="feed-scope-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--text-primary)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
