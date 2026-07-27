"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { tmdbImage } from "@/lib/api";

/* ---------- Types ---------- */

interface WrappedMovie {
  id: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
}
interface RatedFilm extends WrappedMovie {
  rating: number;
}
interface RewatchFilm extends WrappedMovie {
  views: number;
}
interface DatedFilm extends WrappedMovie {
  watchedAt: string | null;
}
interface Tally {
  name: string;
  count: number;
}

export interface WrappedData {
  year: number;
  totalFilms: number;
  uniqueFilms?: number;
  totalHours?: number;
  filmsMissingRuntime?: number;
  theatreVisits?: number;
  rewatchCount?: number;
  mostRewatched?: RewatchFilm | null;
  streak?: number;
  topRated?: RatedFilm[];
  topGenres?: Tally[];
  topMoods?: Tally[];
  topDirector?: Tally | null;
  firstFilm?: DatedFilm | null;
  lastFilm?: DatedFilm | null;
}

/* ---------- Card palette (cinema-dark, warm accents) ---------- */

const GRADIENTS = [
  "linear-gradient(160deg, #1a1114 0%, #3a1020 100%)",
  "linear-gradient(160deg, #12100a 0%, #4a2c06 100%)",
  "linear-gradient(160deg, #0f1410 0%, #123024 100%)",
  "linear-gradient(160deg, #140f1a 0%, #2e1042 100%)",
  "linear-gradient(160deg, #1a1114 0%, #95122C 100%)",
];

/* ---------- Small building blocks ---------- */

function BigStat({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  return (
    <div className="text-center">
      <div className="display flex items-end justify-center gap-2 font-black leading-none text-white" style={{ fontSize: "clamp(3.5rem, 18vw, 7rem)" }}>
        {value}
        {unit && <span className="pb-2 text-2xl font-bold text-white/70">{unit}</span>}
      </div>
      <p className="mt-4 text-base font-medium text-white/80">{caption}</p>
    </div>
  );
}

function Poster({ path, className = "" }: { path: string | null; className?: string }) {
  return (
    <div className={`aspect-[2/3] overflow-hidden rounded-xl bg-black/30 ${className}`}>
      {path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tmdbImage(path, "w300")} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};
const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
};

/* ---------- Card definitions ---------- */

function buildCards(d: WrappedData): { key: string; render: () => ReactNode }[] {
  const cards: { key: string; render: () => ReactNode }[] = [];

  cards.push({
    key: "intro",
    render: () => (
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center">
        <motion.p variants={rise} className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">SlateClub Wrapped</motion.p>
        <motion.h1 variants={rise} className="display mt-3 font-black text-white" style={{ fontSize: "clamp(4rem, 22vw, 9rem)" }}>{d.year}</motion.h1>
        <motion.p variants={rise} className="mt-4 max-w-xs text-center text-white/75">A year of watching, rated and remembered. Tap through your reel.</motion.p>
      </motion.div>
    ),
  });

  cards.push({
    key: "count",
    render: () => (
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center gap-8">
        <motion.div variants={rise}><BigStat value={String(d.totalFilms)} caption={`films logged in ${d.year}`} /></motion.div>
        {d.totalHours != null && (
          <motion.div variants={rise}>
            <BigStat value={String(Math.round(d.totalHours))} unit="hrs" caption={d.filmsMissingRuntime ? `on screen · runtime unknown for ${d.filmsMissingRuntime}` : "on screen"} />
          </motion.div>
        )}
      </motion.div>
    ),
  });

  if ((d.theatreVisits ?? 0) > 0 || (d.rewatchCount ?? 0) > 0 || (d.streak ?? 0) > 1) {
    cards.push({
      key: "habits",
      render: () => (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid w-full max-w-sm grid-cols-2 gap-4">
          {[
            { n: d.theatreVisits ?? 0, label: "theatre trips" },
            { n: d.rewatchCount ?? 0, label: "rewatches" },
            { n: d.streak ?? 0, label: "day streak" },
            { n: d.uniqueFilms ?? d.totalFilms, label: "unique titles" },
          ].map((s) => (
            <motion.div key={s.label} variants={rise} className="rounded-2xl bg-white/10 p-5 text-center backdrop-blur">
              <div className="display text-4xl font-black text-white">{s.n}</div>
              <p className="mt-1 text-xs text-white/70">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      ),
    });
  }

  if (d.topRated && d.topRated.length > 0) {
    cards.push({
      key: "topRated",
      render: () => (
        <motion.div variants={stagger} initial="hidden" animate="show" className="w-full max-w-sm">
          <motion.h2 variants={rise} className="mb-5 text-center text-lg font-bold text-white">Your highest-rated</motion.h2>
          <div className="space-y-3">
            {d.topRated!.slice(0, 5).map((f, i) => (
              <motion.div key={f.id} variants={rise} className="flex items-center gap-3">
                <span className="w-5 text-center text-lg font-black text-white/50">{i + 1}</span>
                <Poster path={f.posterPath} className="w-10 shrink-0" />
                <span className="flex-1 truncate text-sm font-medium text-white">{f.title}</span>
                <span className="text-sm font-bold text-white/90">★ {f.rating.toFixed(2).replace(/\.?0+$/, "")}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ),
    });
  }

  if (d.mostRewatched) {
    cards.push({
      key: "mostRewatched",
      render: () => (
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center">
          <motion.p variants={rise} className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/70">On repeat</motion.p>
          <motion.div variants={rise}><Poster path={d.mostRewatched!.posterPath} className="w-40" /></motion.div>
          <motion.h2 variants={rise} className="mt-4 text-center text-xl font-bold text-white">{d.mostRewatched!.title}</motion.h2>
          <motion.p variants={rise} className="mt-1 text-white/75">watched {d.mostRewatched!.views}× this year</motion.p>
        </motion.div>
      ),
    });
  }

  if (d.topGenres && d.topGenres.length > 0) {
    cards.push({
      key: "genres",
      render: () => (
        <motion.div variants={stagger} initial="hidden" animate="show" className="w-full max-w-sm">
          <motion.h2 variants={rise} className="mb-5 text-center text-lg font-bold text-white">Your top genres</motion.h2>
          <div className="space-y-2">
            {d.topGenres!.slice(0, 5).map((g, i) => {
              const max = d.topGenres![0].count || 1;
              return (
                <motion.div key={g.name} variants={rise}>
                  <div className="mb-1 flex justify-between text-sm text-white">
                    <span>{i + 1}. {g.name}</span>
                    <span className="text-white/70">{g.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full" style={{ width: `${(g.count / max) * 100}%`, background: "linear-gradient(90deg,#FF9408,#95122C)" }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
          {d.topMoods && d.topMoods.length > 0 && (
            <motion.p variants={rise} className="mt-6 text-center text-sm text-white/75">
              Top mood: <span className="font-semibold text-white">{d.topMoods[0].name}</span>
            </motion.p>
          )}
        </motion.div>
      ),
    });
  }

  if (d.topDirector) {
    cards.push({
      key: "director",
      render: () => (
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
          <motion.p variants={rise} className="text-sm font-semibold uppercase tracking-widest text-white/70">Director of your year</motion.p>
          <motion.h2 variants={rise} className="display mt-4 font-black text-white" style={{ fontSize: "clamp(2rem, 9vw, 3.5rem)" }}>{d.topDirector!.name}</motion.h2>
          <motion.p variants={rise} className="mt-3 text-white/75">{d.topDirector!.count} of their films this year</motion.p>
        </motion.div>
      ),
    });
  }

  if (d.firstFilm || d.lastFilm) {
    cards.push({
      key: "bookends",
      render: () => (
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex w-full max-w-sm items-stretch justify-center gap-8">
          {[{ f: d.firstFilm, label: "First" }, { f: d.lastFilm, label: "Latest" }].map(({ f, label }) =>
            f ? (
              <motion.div key={label} variants={rise} className="flex flex-1 flex-col items-center">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/60">{label}</p>
                <Poster path={f.posterPath} className="w-full" />
                <p className="mt-2 text-center text-sm font-medium text-white line-clamp-2">{f.title}</p>
              </motion.div>
            ) : null,
          )}
        </motion.div>
      ),
    });
  }

  cards.push({
    key: "outro",
    render: () => (
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
        <motion.h2 variants={rise} className="display font-black text-white" style={{ fontSize: "clamp(2.5rem, 12vw, 4.5rem)" }}>That&apos;s a wrap.</motion.h2>
        <motion.p variants={rise} className="mt-4 max-w-xs text-white/75">{d.totalFilms} films, {Math.round(d.totalHours ?? 0)} hours, one unforgettable year of cinema.</motion.p>
      </motion.div>
    ),
  });

  return cards;
}

/* ---------- Story shell ---------- */

export default function WrappedStory({ data }: { data: WrappedData }) {
  const cards = useMemo(() => buildCards(data), [data]);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  const go = useCallback(
    (delta: number) => {
      setDir(delta);
      setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
    },
    [cards.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const atStart = index === 0;
  const atEnd = index === cards.length - 1;

  return (
    <div
      className="relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden"
      style={{ background: GRADIENTS[index % GRADIENTS.length], transition: "background 0.5s ease" }}
    >
      {/* Segmented progress */}
      <div className="flex gap-1.5 p-3">
        {cards.map((c, i) => (
          <div key={c.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: i <= index ? "100%" : "0%" }} />
          </div>
        ))}
      </div>

      {/* Card viewport */}
      <div className="relative flex-1">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={cards[index].key}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            {cards[index].render()}
          </motion.div>
        </AnimatePresence>

        {/* Tap zones (mobile-friendly, 44px+ via full halves) */}
        <button type="button" aria-label="Previous" onClick={() => go(-1)} disabled={atStart} className="absolute inset-y-0 left-0 w-1/3 cursor-pointer disabled:cursor-default" />
        <button type="button" aria-label="Next" onClick={() => go(1)} disabled={atEnd} className="absolute inset-y-0 right-0 w-2/3 cursor-pointer disabled:cursor-default" />
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between px-5 py-3 text-xs text-white/60">
        <span>{index + 1} / {cards.length}</span>
        <span>{atEnd ? "" : "tap to continue →"}</span>
      </div>
    </div>
  );
}
