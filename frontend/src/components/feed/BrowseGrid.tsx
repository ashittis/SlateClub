"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";

interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number | null;
}

type Source = "trending" | "popular" | "top-rated";

const TABS: { key: Source; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "popular", label: "Popular" },
  { key: "top-rated", label: "Top Rated" },
];

/*
  BrowseGrid — always-on movie catalog so a fresh user has
  something to click into. Sourced from TMDB via the existing
  /api/movies/{trending|popular|top-rated} endpoints.
*/
export default function BrowseGrid() {
  const [source, setSource] = useState<Source>("trending");

  const { data, isLoading } = useQuery<{ results: TmdbMovie[] }>({
    queryKey: ["browse", source],
    queryFn: () => apiFetch(`/api/movies/${source}`),
  });

  const items = data?.results ?? [];

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="display text-xl lg:text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Browse all films
        </h2>
        <div className="flex gap-1.5">
          {TABS.map((t) => {
            const active = source === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSource(t.key)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: active ? "var(--text-primary)" : "var(--bg-card)",
                  color: active ? "var(--bg-screening)" : "var(--text-muted)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-lg animate-pulse"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p
          className="text-sm rounded-xl p-6 text-center"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          Couldn&apos;t reach the catalog. Check the backend / TMDB key.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {items.map((m) => (
            <Link
              key={m.id}
              href={`/film/${m.id}`}
              className="group flex flex-col gap-1.5"
            >
              <div
                className="relative aspect-[2/3] rounded-lg overflow-hidden"
                style={{ background: "var(--bg-elevated)" }}
              >
                {m.poster_path && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tmdbImage(m.poster_path, "w300")}
                    alt={m.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                {m.vote_average ? (
                  <span
                    className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: "rgba(10,10,11,0.7)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {m.vote_average.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <p
                className="text-xs truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {m.title}
              </p>
              {m.release_date && (
                <p
                  className="text-[10px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {m.release_date.slice(0, 4)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
