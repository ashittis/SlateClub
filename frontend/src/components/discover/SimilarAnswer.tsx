"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { tmdbImage } from "@/lib/api";
import { titleHref } from "@/lib/titleHref";

export interface SimilarFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  originalLanguage?: string | null;
  matchScore: number;
  explanation: string;
}

export interface SimilarAnswerResponse {
  seed: { tmdbId: number; title: string; mediaType?: string };
  essence?: string | null;
  answer: SimilarFilm[];
  creatorRow?: { label: string; results: SimilarFilm[] } | null;
  poolSize: number;
  offset: number;
  hasMore: boolean;
}

/*
  SimilarAnswer — the deliberate opposite of a poster wall. A tight list of
  ≤5 films, each led by its one-line reason (the answer, not a caption), under
  the seed's essence. "None of these fit" steps to the next 5; there is no
  pagination and no unbounded grid — you came here to decide, not to scroll.
*/
export default function SimilarAnswer({
  data,
  loading,
  seedTitle,
  onMore,
  onClear,
  onOpenFilter,
  languageLabel,
  onSaveAsSlate,
  savingSlate,
}: {
  data?: SimilarAnswerResponse;
  loading: boolean;
  seedTitle?: string;
  onMore: () => void;
  onClear: () => void;
  onOpenFilter?: () => void;
  languageLabel?: string;
  /** When provided, shows a "Save as Slate" bridge for the current answer. */
  onSaveAsSlate?: () => void;
  savingSlate?: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl p-2.5"
            style={{ background: "var(--bg-card)" }}
          >
            <div className="h-[84px] w-14 shrink-0 animate-pulse rounded-lg" style={{ background: "var(--bg-elevated)" }} />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
              <div className="h-3 w-1/3 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const films = data.answer ?? [];

  return (
    <div className="mt-4">
      {/* Essence — the one-sentence thesis of the answer. */}
      {data.essence && (
        <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <span style={{ color: "var(--text-faint)" }}>Because they share — </span>
          <span className="italic" style={{ color: "var(--text-primary)" }}>{data.essence}</span>
        </p>
      )}

      {onOpenFilter && (
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={onOpenFilter}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {languageLabel ? `Language: ${languageLabel}` : "Filter by language"}
          </button>
        </div>
      )}

      {films.length === 0 ? (
        <p
          className="rounded-xl p-4 text-sm"
          style={{ color: "var(--text-faint)", background: "var(--bg-card)", border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          Nothing here in that language. Clear the filter or try a different film.
        </p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.ul
            key={data.offset + (languageLabel ?? "")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-2"
          >
            {films.map((f) => (
              <li key={f.tmdbId}>
                <Link
                  href={titleHref(f.tmdbId, "movie")}
                  className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-glass-6"
                  style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="h-[84px] w-14 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    {f.posterPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={tmdbImage(f.posterPath, "w200")} alt={f.title} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* The reason is the headline — this is why it's here. */}
                    <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                      {f.explanation}
                    </p>
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                      {f.title}
                      {f.releaseDate ? ` · ${f.releaseDate.slice(0, 4)}` : ""}
                    </p>
                  </div>
                  {f.matchScore > 0 && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: "rgba(224,160,80,0.15)", color: "var(--pill-mood)" }}
                    >
                      {f.matchScore}%
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      )}

      {/* Footer — a decision surface, not a pager. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {data.hasMore ? (
          <button
            type="button"
            onClick={onMore}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-[0.97]"
            style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            None of these fit →
          </button>
        ) : (
          <span className="text-sm" style={{ color: "var(--text-faint)" }}>
            That&apos;s everything close to {seedTitle ?? "this film"}.
          </span>
        )}
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--cta-primary)" }}
        >
          Try a different film
        </button>

        {onSaveAsSlate && films.length > 0 && (
          <button
            type="button"
            onClick={onSaveAsSlate}
            disabled={savingSlate}
            className="ml-auto rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-[0.97] disabled:opacity-50"
            style={{ background: "var(--cta-gradient)", color: "var(--bg-screening)" }}
          >
            {savingSlate ? "Saving…" : "Save as Slate"}
          </button>
        )}
      </div>

      {/* Creator & cast — a quiet footer to the whole answer, first view only. */}
      {data.creatorRow && data.creatorRow.results.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            {data.creatorRow.label}
          </h3>
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2 lg:overflow-visible">
            <div className="flex gap-3 lg:grid lg:grid-cols-6">
              {data.creatorRow.results.map((f) => (
                <Link key={f.tmdbId} href={titleHref(f.tmdbId, "movie")} className="w-[120px] shrink-0 lg:w-auto">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    {f.posterPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={tmdbImage(f.posterPath, "w300")} alt={f.title} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-xs" style={{ color: "var(--text-primary)" }}>{f.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
