"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { tmdbImage } from "@/lib/api";
import type { MatchCutItem } from "@/types/user";

interface Props {
  items: MatchCutItem[];
  loading?: boolean;
  /** When ≥2 members, badges read as group consensus. */
  group?: boolean;
}

/*
  MatchCutGrid — consensus picks. Mirrors ForYouGrid's responsive grid,
  with a match-% badge (amber/mood) per poster.
*/
export default function MatchCutGrid({ items, loading, group }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg" style={{ background: "var(--bg-card)" }} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>
        No common ground yet — rate a few more films to sharpen the match.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((m, i) => {
        const pct = Math.round(m.groupScore * 100);
        return (
          <motion.div
            key={m.tmdbId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3) }}
          >
            <Link href={`/film/${m.tmdbId}`} className="group block">
              <div
                className="relative aspect-[2/3] overflow-hidden rounded-lg"
                style={{ background: "var(--bg-elevated)" }}
              >
                {m.posterPath && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tmdbImage(m.posterPath, "w300")}
                    alt={m.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <span
                  className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: "rgba(224,160,80,0.92)", color: "var(--bg-screening)" }}
                  title={group ? "Group match" : "Match"}
                >
                  {pct}%
                </span>
              </div>
              <p className="mt-2 truncate text-xs" style={{ color: "var(--text-primary)" }}>
                {m.title}
              </p>
              {m.perMember.length >= 2 && (
                <p className="truncate text-[10px]" style={{ color: "var(--text-faint)" }}>
                  {m.perMember
                    .map((p) => `${p.username} ${Math.round(p.score * 100)}%`)
                    .join(" · ")}
                </p>
              )}
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
