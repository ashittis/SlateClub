"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { tmdbImage } from "@/lib/api";
import Pill from "@/components/ui/Pill";
import type { ReleaseDay, ReleaseFilm } from "./types";

interface Props {
  days: ReleaseDay[];
}

const LANG_LABEL: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", ml: "Malayalam",
  kn: "Kannada", ko: "Korean", ja: "Japanese", fr: "French", es: "Spanish",
  it: "Italian", de: "German", zh: "Mandarin",
};

const SPAN_DAYS = 31;

/*
  ReleaseCalendar — a horizontal strip of pill-dates (next ~month). Dates with
  releases carry a dot; the active date springs into focus and reveals that
  day's films below in a staggered reveal.
*/
export default function ReleaseCalendar({ days }: Props) {
  const filmsByDate = useMemo(() => {
    const map: Record<string, ReleaseFilm[]> = {};
    for (const d of days) map[d.date] = d.films;
    return map;
  }, [days]);

  // Build the next ~month of date keys (local time).
  const dateKeys = useMemo(() => {
    const out: string[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < SPAN_DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(toKey(d));
    }
    return out;
  }, []);

  // Default to the first date that actually has releases (else today).
  const firstWithFilms = useMemo(
    () => dateKeys.find((k) => filmsByDate[k]?.length) ?? dateKeys[0],
    [dateKeys, filmsByDate],
  );
  const [active, setActive] = useState<string>(firstWithFilms);

  const activeFilms = filmsByDate[active] ?? [];

  return (
    <div className="mt-2">
      <h2
        className="display text-xl lg:text-2xl font-bold tracking-tight mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Release calendar
      </h2>

      {/* Date pill strip */}
      <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2">
        <div className="flex gap-2">
          {dateKeys.map((key) => {
            const d = new Date(key + "T00:00:00");
            const has = !!filmsByDate[key]?.length;
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className="relative shrink-0 rounded-2xl px-3 py-2 text-center transition-colors"
                style={{
                  minWidth: 52,
                  background: isActive ? "transparent" : "var(--bg-card)",
                  border: `1px solid ${isActive ? "transparent" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="cal-active"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: "var(--cta-primary)" }}
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  />
                )}
                <span className="relative block">
                  <span
                    className="block text-[10px] uppercase tracking-wide"
                    style={{
                      color: isActive ? "var(--bg-screening)" : "var(--text-faint)",
                    }}
                  >
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span
                    className="block text-base font-bold leading-tight"
                    style={{
                      color: isActive ? "var(--bg-screening)" : "var(--text-primary)",
                    }}
                  >
                    {d.getDate()}
                  </span>
                  <span
                    className="mx-auto mt-1 block h-1 w-1 rounded-full"
                    style={{
                      background: has
                        ? isActive
                          ? "var(--bg-screening)"
                          : "var(--cta-primary)"
                        : "transparent",
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active day's releases */}
      <p className="mt-4 mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
        {longDate(active)}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {activeFilms.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center text-sm"
              style={{
                color: "var(--text-faint)",
                background: "var(--bg-card)",
                border: "1px dashed rgba(255,255,255,0.06)",
              }}
            >
              No releases on this date.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeFilms.map((f, i) => (
                <motion.div
                  key={f.tmdbId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.25 }}
                >
                  <Link
                    href={`/film/${f.tmdbId}`}
                    className="flex overflow-hidden rounded-xl transition-colors hover:opacity-95"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      className="w-16 aspect-[2/3] shrink-0"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      {f.posterPath && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={tmdbImage(f.posterPath, "w200")}
                          alt={f.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <p
                        className="text-sm font-semibold leading-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {f.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {f.originalLanguage && (
                          <Pill kind="language" size="sm" interactive={false}>
                            {LANG_LABEL[f.originalLanguage] ??
                              f.originalLanguage.toUpperCase()}
                          </Pill>
                        )}
                        {f.voteAverage ? (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-faint)" }}
                          >
                            ★ {f.voteAverage.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function longDate(key: string): string {
  const d = new Date(key + "T00:00:00");
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
