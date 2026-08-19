"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { filmKeys, filmsApi, type FilmCard } from "@/lib/api/films";
import type { LogFilm } from "@/stores/logStore";
import { searchApi, searchKeys } from "@/lib/api/search";

/**
 * Step one of logging from outside a film page: which film?
 *
 * Opening cold on an empty search box asks you to remember an exact title
 * before you can do anything. Most logs are of something recent or something
 * you meant to watch, so the resting state offers your watchlist and what's
 * trending — usually the film is already on screen.
 */
export default function LogFilmPicker({
  onPick,
}: {
  onPick: (film: LogFilm) => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const searching = debounced.length > 0;

  const { data: results, isFetching } = useQuery({
    queryKey: searchKeys.films(debounced),
    queryFn: () => searchApi.films(debounced),
    enabled: searching,
  });

  const { data: trending } = useQuery({
    queryKey: filmKeys.search("__log_picker"),
    queryFn: () => filmsApi.trending(),
    enabled: !searching,
  });

  const films: FilmCard[] = searching
    ? (results?.results ?? [])
    : (trending?.results ?? []).slice(0, 12);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Which film?"
        aria-label="Search for a film to log"
        autoFocus
        className="pill min-h-[48px] w-full shrink-0 border px-4 text-base outline-none"
        style={{
          borderColor: "var(--edge-hot)",
          background: "var(--void)",
          color: "var(--chalk)",
        }}
      />

      {!searching && (
        <p className="section-label mt-4 shrink-0">Trending this week</p>
      )}

      {searching && isFetching && films.length === 0 && (
        <p className="meta mt-4">Searching…</p>
      )}
      {searching && !isFetching && films.length === 0 && (
        <p className="mt-4 text-sm" style={{ color: "var(--xerox)" }}>
          Nothing matching “{debounced}”.
        </p>
      )}

      <ul
        className="mt-2 min-h-0 flex-1 overflow-y-auto border-t"
        style={{ borderColor: "var(--edge)" }}
      >
        {films.map((f) => (
          <li key={f.tmdbId} className="border-b" style={{ borderColor: "var(--edge)" }}>
            <button
              type="button"
              onClick={() => onPick(f)}
              className="row-hover flex w-full min-h-[64px] items-center gap-3 px-2 py-2 text-left"
            >
              <Image
                src={tmdbImage(f.posterPath, "w200")}
                alt=""
                width={36}
                height={54}
                className="poster shrink-0 object-cover"
                unoptimized
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{f.title}</span>
                <span className="meta block">{f.year ?? "—"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
