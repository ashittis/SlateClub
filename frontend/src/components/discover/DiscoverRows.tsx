"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import RankedRow, { type TrendingItem } from "@/components/discover/RankedRow";

interface HiddenGem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  twinHighRatings: number;
  globalVoteCount: number | null;
}

/*
  DiscoverRows — the honest browse rows that moved onto Home when Discover was
  absorbed: one theatres/OTT toggle (a single /trending call returns both) and
  Hidden gems. Deliberately just two rows — Home already carries the hero, the
  essence answer, and For You.
*/
export default function DiscoverRows() {
  const [tab, setTab] = useState<"theatrical" | "ott">("theatrical");

  const trending = useQuery<{ theatrical: TrendingItem[]; ott: TrendingItem[] }>({
    queryKey: ["discover-trending"],
    queryFn: () => apiFetch("/api/discover/trending"),
  });

  const hiddenGems = useQuery<{ items: HiddenGem[] }>({
    queryKey: ["hidden-gems"],
    queryFn: () => apiFetch("/api/cultural/hidden-gems"),
  });

  const rows = trending.data?.[tab] ?? [];

  return (
    <div className="mt-10 space-y-10">
      {/* In theatres | New on OTT — one toggle, one query. */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          {(["theatrical", "ott"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
              style={{
                background: tab === t ? "var(--cta-primary)" : "var(--bg-elevated)",
                color: tab === t ? "var(--bg-screening)" : "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {t === "theatrical" ? "In theatres now" : "New on OTT"}
            </button>
          ))}
        </div>
        {trending.isLoading ? (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Loading…</p>
        ) : (
          <RankedRow items={rows} />
        )}
      </section>

      {/* Hidden gems — loved by your twins, under-rated globally. */}
      <section>
        <h2 className="display mb-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Hidden gems
        </h2>
        <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
          Loved by your twins, under-rated globally.
        </p>
        {hiddenGems.isLoading ? null : hiddenGems.data && hiddenGems.data.items.length > 0 ? (
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2 lg:overflow-visible">
            <div className="flex gap-3 lg:grid lg:grid-cols-6">
              {hiddenGems.data.items.map((g) => (
                <Link key={g.tmdbId} href={`/film/${g.tmdbId}`} className="w-[120px] shrink-0 lg:w-auto">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    {g.posterPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`https://image.tmdb.org/t/p/w300${g.posterPath}`} alt={g.title} className="h-full w-full object-cover" loading="lazy" />
                    )}
                    <span
                      className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: "var(--pill-mood)", color: "var(--bg-screening)" }}
                    >
                      {g.twinHighRatings}★ twins
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs" style={{ color: "var(--text-primary)" }}>{g.title}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="px-1 text-xs" style={{ color: "var(--text-faint)" }}>
            Nothing yet — collect a few twin ratings and gems will surface.
          </p>
        )}
      </section>
    </div>
  );
}
