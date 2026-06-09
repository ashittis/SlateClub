"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";

export interface PickedFilm {
  id: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  mediaType?: "movie" | "tv";
}

interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number | null;
}

type Hit = TmdbMovie & { media_type: "movie" | "tv" };

interface Props {
  onSubmit: (film: PickedFilm) => void;
  pending: boolean;
  /** Controlled seed film — set to restore the chip (e.g. after a refresh). */
  value?: PickedFilm | null;
  /** Called when the user clears the picked film. */
  onClear?: () => void;
  /** True once results exist for the current seed — flips the CTA to "Show more". */
  hasResults?: boolean;
  /** Called when "Show more" is pressed (generate/navigate the next page). */
  onMore?: () => void;
}

/*
  MoviesLikeBuilder — the "Show me movies like ___" companion to SentenceBuilder.
  Type a film name, pick the exact title from a live autocomplete, then run it
  through the recommendation engine's similarity tuning. Mirrors the
  SentenceBuilder card shell and the MovieSearchBar input/dropdown pattern.
*/
export default function MoviesLikeBuilder({
  onSubmit,
  pending,
  value,
  onClear,
  hasResults,
  onMore,
}: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PickedFilm | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Restore (or clear) the chip when a controlled value is supplied — lets the
  // page rehydrate the seed film after a browser refresh.
  useEffect(() => {
    if (value) {
      setPicked(value);
      setQuery(value.title);
    } else {
      setPicked(null);
      setQuery("");
    }
  }, [value]);

  const filmsQuery = useQuery<{ results: TmdbMovie[] }>({
    queryKey: ["movies-like-search", debounced],
    queryFn: () =>
      apiFetch<{ results: TmdbMovie[] }>(
        `/api/movies/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.length >= 2 && !picked,
    staleTime: 60_000,
  });

  const seriesQuery = useQuery<{ results: TmdbMovie[] }>({
    queryKey: ["series-like-search", debounced],
    queryFn: () =>
      apiFetch<{ results: TmdbMovie[] }>(
        `/api/series/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.length >= 2 && !picked,
    staleTime: 60_000,
  });

  // Interleave films + series, most-popular-ish first, so either can anchor.
  const hits: Hit[] = [
    ...(filmsQuery.data?.results ?? []).map((m) => ({ ...m, media_type: "movie" as const })),
    ...(seriesQuery.data?.results ?? []).map((m) => ({ ...m, media_type: "tv" as const })),
  ]
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, 8);
  const isFetching = filmsQuery.isFetching || seriesQuery.isFetching;
  const showDropdown = open && !picked && debounced.length >= 2;
  const empty = showDropdown && !isFetching && hits.length === 0;
  // The CTA becomes "Show more" only when results exist for the title currently
  // picked (the active seed). Choosing a different title resets it to "Show me".
  const isMore = !!hasResults && !!picked && picked.id === value?.id;

  function pick(m: Hit) {
    setPicked({
      id: m.id,
      title: m.title,
      posterPath: m.poster_path,
      releaseDate: m.release_date,
      mediaType: m.media_type,
    });
    setQuery(m.title);
    setOpen(false);
  }

  function clearPick() {
    setPicked(null);
    setQuery("");
    setDebounced("");
    onClear?.();
  }

  return (
    <div
      className="rounded-2xl p-5 lg:p-6"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 24px 60px -28px rgba(0,0,0,0.55)",
      }}
    >
      <div
        className="display text-xl lg:text-2xl leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-3"
        style={{ color: "var(--text-primary)" }}
      >
        <span>Show me something like</span>

        {picked ? (
          <button
            type="button"
            onClick={clearPick}
            className="inline-flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5 text-base font-semibold transition-colors hover:opacity-90 active:scale-[0.97]"
            style={{
              background: "var(--pill-mood)",
              color: "var(--bg-screening)",
            }}
          >
            {picked.posterPath && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tmdbImage(picked.posterPath, "w200")}
                alt={picked.title}
                className="w-6 aspect-[2/3] rounded object-cover"
              />
            )}
            <span className="truncate max-w-[14rem]">{picked.title}</span>
            <span aria-hidden className="opacity-70">
              ✕
            </span>
          </button>
        ) : (
          <div className="relative min-w-[16rem] flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: "var(--text-faint)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 180)}
              placeholder="a film or series…"
              className="w-full rounded-full pl-10 pr-4 py-3 text-base focus:outline-none"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--text-primary)",
              }}
            />
            {isFetching && (
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--text-faint)" }}
              >
                …
              </span>
            )}

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 z-30 mt-2 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
                  }}
                >
                  {empty && (
                    <p
                      className="px-4 py-4 text-sm"
                      style={{ color: "var(--text-faint)" }}
                    >
                      Nothing found.
                    </p>
                  )}
                  {hits.map((m) => (
                    <button
                      key={`${m.media_type}-${m.id}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(m)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:opacity-90"
                    >
                      <div
                        className="w-10 aspect-[2/3] rounded shrink-0 overflow-hidden"
                        style={{ background: "var(--bg-elevated)" }}
                      >
                        {m.poster_path && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={tmdbImage(m.poster_path, "w200")}
                            alt={m.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {m.title}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {m.media_type === "tv" ? "Series" : "Film"}
                          {m.release_date ? ` · ${m.release_date.slice(0, 4)}` : ""}
                          {m.vote_average ? ` · ${m.vote_average.toFixed(1)}★` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {picked
            ? "Matched by essence — tone, tension & moral world, across films & series."
            : "Pick a film or series to anchor the recommendations."}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!picked) return;
            // "Show more" only applies to the film already searched; picking a
            // different title reverts to a fresh "Show me" search.
            if (isMore) onMore?.();
            else onSubmit(picked);
          }}
          disabled={!picked || pending}
          className="px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
          style={{
            background: "var(--cta-gradient)",
            color: "var(--bg-screening)",
            cursor: picked && !pending ? "pointer" : "not-allowed",
            boxShadow:
              picked && !pending
                ? "0 12px 28px -10px rgba(255, 138, 0, 0.55)"
                : "none",
          }}
        >
          {pending
            ? isMore
              ? "Finding more…"
              : "Tuning…"
            : isMore
              ? "Show more"
              : "Show me →"}
        </button>
      </div>
    </div>
  );
}
