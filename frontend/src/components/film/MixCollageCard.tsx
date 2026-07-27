"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import CardStack from "@/components/ui/CardStack";
import { tmdbImage } from "@/lib/api";

/*
  MixCollageCard — a "Mix"-style card: a 2x2 poster collage plus a label
  (e.g. "Slow-burn Tamil Noir"). Home's "Made for you" row. Reuses the
  existing CardStack mosaic so covers stay visually consistent with Slates.
*/

interface MixCollageCardProps {
  label: string;
  subtitle?: string;
  posterPaths: (string | null)[];
  href: string;
  width?: number;
}

export default function MixCollageCard({
  label,
  subtitle,
  posterPaths,
  href,
  width = 176,
}: MixCollageCardProps) {
  const posters = posterPaths
    .filter(Boolean)
    .slice(0, 4)
    .map((p) => tmdbImage(p as string, "w300"));

  return (
    <motion.div whileHover={{ scale: 1.03 }} className="shrink-0" style={{ width }}>
      <Link
        href={href}
        className="block overflow-hidden rounded-2xl p-3"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex justify-center">
          <CardStack posters={posters} variant="mosaic" size="sm" alt={label} />
        </div>
        <p
          className="display mt-3 line-clamp-2 text-sm font-bold leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </p>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
