"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";

interface ActivityEvent {
  id: string;
  type: string;
  createdAt?: string;
  created_at?: string;
  metadata?: { rating?: number } | null;
  movie?: {
    id: string;
    tmdbId?: number;
    tmdb_id?: number;
    title: string;
    posterPath?: string;
    poster_path?: string;
  };
}

export default function RecentActivityRow({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity", "user", userId],
    queryFn: () => apiFetch(`/api/activity/user/${userId}?limit=20`),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="mb-3 border-b border-glass-6 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Recent Activity</h2>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-1/4 shrink-0 animate-pulse rounded-lg bg-glass-8 sm:w-[calc((100%-3.75rem)/6)]" />
          ))}
        </div>
      </div>
    );
  }

  // De-dupe by film so the strip reads as distinct titles.
  const seen = new Set<number>();
  const events = (data?.events ?? []).filter((ev) => {
    const id = ev.movie?.tmdbId ?? ev.movie?.tmdb_id;
    if (!id || !ev.movie?.title || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 12);

  if (events.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 border-b border-glass-6 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Recent Activity</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {events.map((ev, i) => {
          const tmdbId = ev.movie!.tmdbId ?? ev.movie!.tmdb_id!;
          const poster = ev.movie!.posterPath ?? ev.movie!.poster_path;
          const rating = ev.type === "rated" ? ev.metadata?.rating : undefined;
          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className="w-1/4 shrink-0 sm:w-[calc((100%-3.75rem)/6)]"
            >
              <Link href={`/film/${tmdbId}`} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tmdbImage(poster, "w300")}
                      alt={ev.movie!.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                  {rating != null && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {rating / 2}★
                    </span>
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
