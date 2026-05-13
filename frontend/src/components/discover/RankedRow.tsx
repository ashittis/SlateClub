"use client";

import Link from "next/link";
import { tmdbImage } from "@/lib/api";
import RankedOverlay from "@/components/ui/RankedOverlay";
import Pill from "@/components/ui/Pill";

export interface TrendingItem {
  rank: number;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  platform: string;
}

interface Props {
  items: TrendingItem[];
}

export default function RankedRow({ items }: Props) {
  return (
    <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
      <div className="flex gap-5 lg:grid lg:grid-cols-5 lg:gap-6">
        {items.slice(0, 10).map((it) => (
          <Link
            key={it.tmdbId}
            href={`/film/${it.tmdbId}`}
            className="shrink-0 lg:shrink relative w-[140px] lg:w-auto"
          >
            <div
              className="relative aspect-[2/3] overflow-hidden rounded-xl"
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
              <div className="absolute top-2 right-2">
                <Pill kind="platform" size="sm" interactive={false}>
                  {it.platform}
                </Pill>
              </div>
            </div>
            <RankedOverlay rank={it.rank} />
            <p
              className="mt-3 ml-1 text-sm font-medium truncate"
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
