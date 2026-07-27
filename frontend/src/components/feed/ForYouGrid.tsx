"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
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

/*
  ForYouGrid — the personalised taste-engine feed.
    variant="preview" (Home): page 1, first 6, with a "See all →" to /for-you.
    variant="full"    (/for-you): infinite — pages through the whole 30-item
                       ranked list (page 2+ used to be unreachable).
  session_mood is read INSIDE queryFn so changing the mood actually refetches.
*/
export default function ForYouGrid({ variant = "preview" }: { variant?: "preview" | "full" }) {
  const { sessionMood } = useFeedStore();
  const { user } = useAuthStore();

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ForYouResponse>({
    queryKey: ["for-you", sessionMood, variant],
    queryFn: ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam) });
      if (sessionMood && sessionMood !== "skip") params.set("session_mood", sessionMood);
      return apiFetch(`/api/recommendations/for-you?${params}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      variant === "full" && last.page * 10 < last.total ? last.page + 1 : undefined,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const all = data?.pages.flatMap((p) => p.results) ?? [];
  const items = variant === "preview" ? all.slice(0, 6) : all;

  const header = (
    <div className="mb-3 flex items-baseline justify-between">
      <div className="flex items-center gap-2.5">
        <h2 className="display text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          For You
        </h2>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(224,160,80,0.15)", color: "var(--pill-mood)" }}
        >
          Taste Engine
        </span>
      </div>
      {variant === "preview" && all.length > 0 && (
        <Link href="/for-you" className="text-xs font-medium hover:opacity-80" style={{ color: "var(--cta-primary)" }}>
          See all →
        </Link>
      )}
    </div>
  );

  if (isError) {
    return (
      <section className="mb-8">
        {header}
        <p
          className="text-xs rounded-xl p-4"
          style={{ color: "var(--text-faint)", background: "var(--bg-card)", border: "1px dashed rgba(255,255,255,0.06)" }}
        >
          Could not load recommendations — {(error as Error)?.message ?? "backend error"}
        </p>
      </section>
    );
  }

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="mb-8">
      {header}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {isLoading
          ? Array.from({ length: variant === "preview" ? 6 : 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg animate-pulse" style={{ background: "var(--bg-card)" }} />
            ))
          : items.map((m) => (
              <Link key={m.id} href={`/film/${m.tmdb_id}`} className="group flex flex-col gap-1.5">
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                  {m.poster_path ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={tmdbImage(m.poster_path, "w300")}
                      alt={m.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full" style={{ background: "var(--bg-card)" }} />
                  )}
                  {m.match_score > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: "rgba(10,10,11,0.75)", color: "var(--pill-mood)" }}
                    >
                      {m.match_score}%
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.title}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-faint)" }}>{m.explanation}</p>
              </Link>
            ))}
      </div>

      {variant === "full" && hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {isFetchingNextPage ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </section>
  );
}
