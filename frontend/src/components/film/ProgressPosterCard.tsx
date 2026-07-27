"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { tmdbImage } from "@/lib/api";
import { titleHref } from "@/lib/titleHref";
import ProgressBar from "@/components/ui/ProgressBar";

/*
  ProgressPosterCard — poster with a "% watched" bar overlaid on the bottom.
  The card variant for Home's "Jump back in" row (and the source shape for
  the Continue Watching bar). Fed by /api/users/me/watching.
*/

interface ProgressPosterCardProps {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  mediaType?: string | null;
  progressPct: number;
  width?: number;
}

export default function ProgressPosterCard({
  tmdbId,
  title,
  posterPath,
  mediaType,
  progressPct,
  width = 150,
}: ProgressPosterCardProps) {
  return (
    <motion.div whileHover={{ scale: 1.03 }} className="shrink-0" style={{ width }}>
      <Link href={titleHref(tmdbId, mediaType)} className="block">
        <div
          className="relative aspect-[2/3] w-full overflow-hidden rounded-xl"
          style={{ background: "var(--bg-elevated)" }}
        >
          {posterPath ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tmdbImage(posterPath, "w300")}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
          {/* Progress overlay */}
          <div
            className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-6"
            style={{
              background:
                "linear-gradient(to top, rgba(10,10,11,0.9), transparent)",
            }}
          >
            <ProgressBar pct={progressPct} />
          </div>
        </div>
        <p
          className="mt-2 truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          {Math.round(progressPct)}% watched
        </p>
      </Link>
    </motion.div>
  );
}
