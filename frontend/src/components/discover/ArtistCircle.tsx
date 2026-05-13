"use client";

import Link from "next/link";
import { tmdbImage } from "@/lib/api";

export interface ArtistItem {
  tmdbId: number;
  name: string;
  role: string;
  profilePath: string | null;
}

interface Props {
  items: ArtistItem[];
}

export default function ArtistCircleRow({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-xs px-1" style={{ color: "var(--text-faint)" }}>
        Pick a few artists in onboarding to populate this row.
      </p>
    );
  }
  return (
    <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
      <div className="flex gap-5 lg:grid lg:grid-cols-8 lg:gap-4">
        {items.map((a) => (
          <Link
            key={a.tmdbId}
            href={`/artists/${a.tmdbId}`}
            className="shrink-0 lg:shrink flex flex-col items-center gap-2 w-20"
          >
            <div
              className="w-20 h-20 rounded-full overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {a.profilePath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(a.profilePath, "w200")}
                  alt={a.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xl"
                  style={{ color: "var(--text-faint)" }}
                >
                  {a.name[0]}
                </div>
              )}
            </div>
            <p
              className="text-xs text-center leading-tight line-clamp-2"
              style={{ color: "var(--text-primary)" }}
            >
              {a.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
