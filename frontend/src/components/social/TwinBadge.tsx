"use client";

import { motion } from "framer-motion";

interface Props {
  score: number; // 0..1
  overlapCount?: number;
}

/*
  TwinBadge — circular % score with a label. Colour brightens
  with score: 70%+ glows green (a "real" twin), below = muted.
*/
export default function TwinBadge({ score, overlapCount }: Props) {
  const pct = Math.round(score * 100);
  const strong = pct >= 70;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="inline-flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1"
      style={{
        background: strong ? "rgba(255, 138, 0, 0.15)" : "var(--bg-card)",
        border: strong
          ? "1px solid rgba(255, 138, 0, 0.45)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold display"
        style={{
          background: strong ? "var(--cta-primary)" : "var(--bg-elevated)",
          color: strong ? "var(--bg-screening)" : "var(--text-primary)",
        }}
      >
        {pct}%
      </span>
      <span className="text-xs" style={{ color: "var(--text-primary)" }}>
        Taste twin
        {typeof overlapCount === "number" && overlapCount > 0 && (
          <span style={{ color: "var(--text-faint)" }}> · {overlapCount} films</span>
        )}
      </span>
    </motion.div>
  );
}
