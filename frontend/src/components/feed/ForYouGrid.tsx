"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useFeedStore } from "@/stores/feedStore";
import { useAuthStore } from "@/stores/authStore";

interface ForYouItem {
  id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  explanation: string;
  surface: string;
  match_score: number;
}

interface ForYouResponse {
  results: ForYouItem[];
  page: number;
  total: number;
  pipeline: string;
}

export default function ForYouGrid() {
  const { sessionMood } = useFeedStore();
  const { user } = useAuthStore();

  const params = new URLSearchParams({ page: "1" });
  if (sessionMood && sessionMood !== "skip") {
    params.set("session_mood", sessionMood);
  }

  const { data, isLoading, isError, error } = useQuery<ForYouResponse>({
    queryKey: ["for-you", sessionMood],
    queryFn: () => apiFetch(`/api/recommendations/for-you?${params}`),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const items = data?.results ?? [];

  // Show error state visibly during development so it's clear what went wrong.
  if (isError) {
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <h2
            className="display text-xl lg:text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            For You
          </h2>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(224,160,80,0.15)", color: "var(--pill-mood)" }}
          >
            Taste Engine
          </span>
        </div>
        <p
          className="text-xs rounded-xl p-4"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          Could not load recommendations —{" "}
          {(error as Error)?.message ?? "backend error"}
        </p>
      </section>
    );
  }

  if (!isLoading && items.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <h2
            className="display text-xl lg:text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            For You
          </h2>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(224,160,80,0.15)",
              color: "var(--pill-mood)",
            }}
          >
            Taste Engine
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-lg animate-pulse"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {items.map((m) => (
            <Link
              key={m.id}
              href={`/film/${m.tmdb_id}`}
              className="group flex flex-col gap-1.5"
            >
              <div
                className="relative aspect-[2/3] rounded-lg overflow-hidden"
                style={{ background: "var(--bg-elevated)" }}
              >
                {m.poster_path ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tmdbImage(m.poster_path, "w300")}
                    alt={m.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ background: "var(--bg-card)" }}
                  />
                )}
                {m.match_score > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: "rgba(10,10,11,0.75)",
                      color: "var(--pill-mood)",
                    }}
                  >
                    {m.match_score}%
                  </span>
                )}
              </div>
              <p
                className="text-xs font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {m.title}
              </p>
              <p
                className="text-[10px] truncate"
                style={{ color: "var(--text-faint)" }}
              >
                {m.explanation}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
