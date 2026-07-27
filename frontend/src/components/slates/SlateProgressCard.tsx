"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import CardStack from "@/components/ui/CardStack";
import ProgressBar from "@/components/ui/ProgressBar";
import { tmdbImage } from "@/lib/api";
import type { SlateCard as SlateCardType } from "@/types/slates";

/*
  SlateProgressCard — a compact Slate cover with a "watched N/total" progress
  bar, for Home's "Continue your Slates" row. Reuses the SlateCard cover look
  (CardStack) but is horizontal-rail sized and progress-aware.

  `watchedCount` is derived client-side (or from the slate payload when the
  API provides it); when absent it renders as a plain cover card.
*/

interface SlateProgressCardProps {
  slate: SlateCardType;
  watchedCount?: number;
  width?: number;
}

export default function SlateProgressCard({
  slate,
  watchedCount,
  width = 176,
}: SlateProgressCardProps) {
  const posters = slate.coverPosters.map((p) => tmdbImage(p, "w300"));
  while (posters.length < 4) posters.push("");
  const variant =
    slate.coverLayout === "stack_3"
      ? "fan"
      : slate.coverLayout === "spiral"
        ? "spiral"
        : "mosaic";

  const total = slate.filmCount;
  const done = watchedCount ?? 0;
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <motion.div whileHover={{ scale: 1.03 }} className="shrink-0" style={{ width }}>
      <Link
        href={`/slates/${slate.id}`}
        className="block overflow-hidden rounded-2xl p-3"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex justify-center">
          <CardStack posters={posters} variant={variant} size="sm" alt={slate.title} />
        </div>
        <h3
          className="display mt-3 truncate text-sm font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {slate.title}
        </h3>
        {watchedCount != null ? (
          <div className="mt-2">
            <ProgressBar pct={pct} />
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
              {done}/{total} watched
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
            {total} film{total === 1 ? "" : "s"}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
