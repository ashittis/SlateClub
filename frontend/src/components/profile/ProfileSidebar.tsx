"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { Movie } from "@/types/movie";
import { titleHref } from "@/lib/titleHref";
import { diaryDayParts } from "@/lib/profileFormat";

interface WatchedMovie extends Movie {
  watchedAt?: string | null;
}

function SidebarHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b border-glass-6 pb-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>{label}</h2>
      {count != null && count > 0 && (
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{count}</span>
      )}
    </div>
  );
}

function WatchlistBlock() {
  const { data } = useQuery<Movie[]>({
    queryKey: ["profile", "watchlist"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/watchlist"),
  });

  const items = (data ?? []).slice(0, 5);
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <SidebarHeader label="Watchlist" count={data?.length} />
      <div className="flex -space-x-3">
        {items.map((m, i) => (
          <Link
            key={m.id}
            href={titleHref(m.tmdbId, m.mediaType)}
            className="block w-1/5 shrink-0 transition-transform hover:z-10 hover:-translate-y-1"
            style={{ zIndex: items.length - i }}
          >
            <div className="aspect-[2/3] overflow-hidden rounded-md ring-1 ring-black/40" style={{ background: "var(--bg-elevated)" }}>
              {m.posterPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tmdbImage(m.posterPath, "w200")} alt={m.title} className="h-full w-full object-cover" loading="lazy" />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DiaryBlock() {
  const { data } = useQuery<WatchedMovie[]>({
    queryKey: ["profile", "watched"],
    queryFn: () => apiFetch<WatchedMovie[]>("/api/users/me/watched"),
  });

  const dated = (data ?? []).filter((m) => m.watchedAt).slice(0, 6);
  if (dated.length === 0) return null;

  return (
    <div>
      <SidebarHeader label="Diary" count={data?.length} />
      <div className="space-y-1">
        {dated.map((m) => {
          const { day, month } = diaryDayParts(m.watchedAt!);
          return (
            <Link
              key={m.id}
              href={titleHref(m.tmdbId, m.mediaType)}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-glass-6"
            >
              <div className="flex w-8 shrink-0 flex-col items-center leading-none">
                <span className="text-[9px] font-semibold tracking-wide" style={{ color: "var(--text-faint)" }}>{month}</span>
                <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>{day}</span>
              </div>
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text-primary)" }}>{m.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ProfileSidebar() {
  return (
    <aside>
      <WatchlistBlock />
      <DiaryBlock />
    </aside>
  );
}
