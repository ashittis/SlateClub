"use client";

import Link from "next/link";
import { tmdbImage } from "@/lib/api";

export interface TwinNowItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  watchedBy: { username: string; name: string; avatarUrl: string | null };
  watchedAt: string;
}

interface Props {
  items: TwinNowItem[];
}

export default function TwinRail({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-xs px-1" style={{ color: "var(--text-faint)" }}>
        Quiet on the twin front. Check back later.
      </p>
    );
  }
  return (
    <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
      <div className="flex gap-4 lg:grid lg:grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.tmdbId + it.watchedBy.username}
            href={`/film/${it.tmdbId}`}
            className="shrink-0 lg:shrink w-[150px] lg:w-auto"
          >
            <div
              className="relative aspect-[2/3] rounded-xl overflow-hidden"
              style={{ background: "var(--bg-elevated)" }}
            >
              {it.posterPath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(it.posterPath, "w300")}
                  alt={it.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <div
                className="absolute bottom-0 left-0 right-0 px-3 py-2 text-xs"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)",
                  color: "var(--text-primary)",
                }}
              >
                {it.watchedBy.name} just watched
              </div>
            </div>
            <p
              className="mt-2 text-sm font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {it.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
