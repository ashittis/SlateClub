"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { titleHref } from "@/lib/titleHref";
import ProgressBar from "@/components/ui/ProgressBar";

/*
  ContinueWatchingBar — persistent bottom "resume" bar (spec §0), the film
  analogue of Spotify's now-playing player. Shows the most-recently-updated
  in-progress title with a resume link + progress. Collapses to nothing when
  there's nothing in progress (no empty state), and can be dismissed.

  Data is derived from /api/users/me/watching (no dedicated endpoint yet).
*/

interface WatchingItem {
  tmdbId: number;
  mediaType: string | null;
  title: string;
  posterPath: string | null;
  progressPct: number;
}

export default function ContinueWatchingBar() {
  const { user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  const watching = useQuery<WatchingItem[]>({
    queryKey: ["me-watching"],
    queryFn: () => apiFetch("/api/users/me/watching"),
    enabled: !!user,
    staleTime: 30_000,
  });

  const current = watching.data?.[0];
  const active = !!current && !dismissed;

  // Reserve bottom space for page content while the bar is shown.
  useEffect(() => {
    document.body.setAttribute("data-cw-active", active ? "true" : "false");
    return () => document.body.removeAttribute("data-cw-active");
  }, [active]);

  if (!active || !current) return null;

  return (
    <div
      className="fixed bottom-14 left-0 right-0 z-40 lg:bottom-0 lg:left-60"
      style={{
        background: "var(--bg-elevated)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        {/* Poster thumb */}
        <Link href={titleHref(current.tmdbId, current.mediaType)} className="shrink-0">
          <div
            className="relative h-11 w-8 overflow-hidden rounded"
            style={{ background: "var(--bg-card)" }}
          >
            {current.posterPath ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tmdbImage(current.posterPath, "w200")}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
        </Link>

        {/* Title + progress */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {current.title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar pct={current.progressPct} className="max-w-xs" />
            <span className="shrink-0 text-xs" style={{ color: "var(--text-faint)" }}>
              {Math.round(current.progressPct)}%
            </span>
          </div>
        </div>

        {/* Resume */}
        <Link
          href={titleHref(current.tmdbId, current.mediaType)}
          className="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}
        >
          Resume
        </Link>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1.5 hover:bg-white/10"
          style={{ color: "var(--text-muted)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
