"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { tmdbImage } from "@/lib/api";
import type { ReleaseFilm } from "./types";

interface Props {
  films: ReleaseFilm[];
}

const SWIPE_THRESHOLD = 60; // px / momentum to advance

/*
  ReleaseCarousel — a CoverFlow deck: the centre poster sits flat and large,
  neighbours recede in 3D (scale + rotateY + depth shadow). The active film's
  backdrop fills the panel as a blurred, gradient-lit ambient layer. Drag /
  swipe to move; tap a side card to focus it; tap the centre to open the film.
*/
export default function ReleaseCarousel({ films }: Props) {
  const router = useRouter();
  const [active, setActive] = useState(0);

  // Reset to the first card whenever the set changes (toggling Upcoming/Biggies).
  useEffect(() => {
    setActive(0);
  }, [films]);

  if (films.length === 0) {
    return (
      <div
        className="mt-4 rounded-2xl p-10 text-center text-sm"
        style={{
          color: "var(--text-faint)",
          background: "var(--bg-card)",
          border: "1px dashed rgba(255,255,255,0.06)",
        }}
      >
        Nothing lined up for this window yet — check back soon.
      </div>
    );
  }

  const clamp = (i: number) => Math.max(0, Math.min(films.length - 1, i));
  const go = (dir: number) => setActive((a) => clamp(a + dir));

  function onDragEnd(_: unknown, info: PanInfo) {
    const power = info.offset.x + info.velocity.x * 0.2;
    if (power < -SWIPE_THRESHOLD) go(1);
    else if (power > SWIPE_THRESHOLD) go(-1);
  }

  const activeFilm = films[active];

  return (
    <div
      className="relative mt-4 overflow-hidden rounded-2xl"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Ambient backdrop — blurred active poster + gradient + radial glow */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeFilm.tmdbId}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {activeFilm.backdropPath || activeFilm.posterPath ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tmdbImage(
                activeFilm.backdropPath ?? activeFilm.posterPath,
                "w780",
              )}
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
              style={{ filter: "blur(40px) saturate(1.3)", transform: "scale(1.2)" }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 38%, rgba(92,165,114,0.16), transparent 70%), linear-gradient(180deg, rgba(10,10,11,0.72) 0%, rgba(10,10,11,0.88) 60%, var(--bg-screening) 100%)",
        }}
      />

      {/* Deck */}
      <motion.div
        className="relative h-[380px] sm:h-[440px] lg:h-[460px] select-none"
        style={{ perspective: 1200 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={onDragEnd}
      >
        {films.map((f, i) => {
          const offset = i - active;
          const abs = Math.abs(offset);
          if (abs > 2) {
            return null;
          }
          const isCenter = offset === 0;
          return (
            <motion.div
              key={f.tmdbId}
              className="absolute left-1/2 top-1/2 cursor-pointer"
              style={{ transformStyle: "preserve-3d" }}
              animate={{
                x: `calc(-50% + ${offset * 132}px)`,
                y: "-50%",
                scale: 1 - abs * 0.13,
                rotateY: Math.max(-30, Math.min(30, -offset * 16)),
                opacity: 1 - abs * 0.18,
                zIndex: 50 - abs,
                filter: isCenter ? "brightness(1)" : "brightness(0.6)",
              }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              onClick={() =>
                isCenter ? router.push(`/film/${f.tmdbId}`) : setActive(i)
              }
            >
              <div
                className="w-[180px] sm:w-[210px] lg:w-[230px] aspect-[2/3] overflow-hidden rounded-xl"
                style={{
                  background: "var(--bg-elevated)",
                  boxShadow: isCenter
                    ? "0 30px 70px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)"
                    : "0 18px 40px -16px rgba(0,0,0,0.7)",
                }}
              >
                {f.posterPath ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tmdbImage(f.posterPath, isCenter ? "w500" : "w300")}
                    alt={f.title}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Centre film meta */}
      <div className="relative px-5 pb-5 -mt-2 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFilm.tmdbId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <h3
              className="display text-lg lg:text-xl font-bold tracking-tight truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {activeFilm.title}
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {formatDate(activeFilm.releaseDate)}
              {activeFilm.voteAverage
                ? ` · ★ ${activeFilm.voteAverage.toFixed(1)}`
                : ""}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrows (desktop) */}
      {active > 0 && (
        <Arrow side="left" onClick={() => go(-1)} />
      )}
      {active < films.length - 1 && (
        <Arrow side="right" onClick={() => go(1)} />
      )}
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={`absolute top-1/2 z-[60] hidden -translate-y-1/2 items-center justify-center rounded-full lg:flex ${
        side === "left" ? "left-3" : "right-3"
      }`}
      style={{
        width: 40,
        height: 40,
        background: "rgba(10,10,11,0.6)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(8px)",
        color: "var(--text-primary)",
      }}
    >
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {side === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
