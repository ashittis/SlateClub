"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { tmdbImage } from "@/lib/api";

/*
  SplitPosterCard — two posters split on a diagonal seam, used for Match Cut
  cards on Home ("Match Cuts for you") and Film Detail ("Match Cuts featuring
  this film"). An optional match % sits over the seam.
*/

interface SplitPosterCardProps {
  leftPoster: string | null;
  rightPoster: string | null;
  leftTitle?: string;
  rightTitle?: string;
  label?: string;
  matchPct?: number | null;
  href: string;
  width?: number;
}

export default function SplitPosterCard({
  leftPoster,
  rightPoster,
  leftTitle,
  rightTitle,
  label,
  matchPct,
  href,
  width = 190,
}: SplitPosterCardProps) {
  return (
    <motion.div whileHover={{ scale: 1.03 }} className="shrink-0" style={{ width }}>
      <Link href={href} className="block">
        <div
          className="relative aspect-[3/2] w-full overflow-hidden rounded-xl"
          style={{ background: "var(--bg-elevated)" }}
        >
          {/* Left half — clipped on a diagonal */}
          <div
            className="absolute inset-0"
            style={{ clipPath: "polygon(0 0, 58% 0, 42% 100%, 0 100%)" }}
          >
            {leftPoster ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tmdbImage(leftPoster, "w300")}
                alt={leftTitle ?? ""}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          {/* Right half */}
          <div
            className="absolute inset-0"
            style={{ clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)" }}
          >
            {rightPoster ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tmdbImage(rightPoster, "w300")}
                alt={rightTitle ?? ""}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          {/* Seam highlight */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(105deg, transparent 40%, rgba(255,120,0,0.5) 50%, transparent 60%)",
              mixBlendMode: "screen",
            }}
          />
          {matchPct != null && (
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-sm"
              style={{ background: "rgba(10,10,11,0.72)", color: "var(--cta-primary)" }}
            >
              {Math.round(matchPct)}%
            </span>
          )}
        </div>
        {label && (
          <p
            className="mt-2 truncate text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {label}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
