"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import FeedRow from "@/components/ui/FeedRow";
import ProgressPosterCard from "@/components/film/ProgressPosterCard";

/*
  "Jump back in" — the spec's first home row: in-progress titles with a
  progress-bar overlay. Sourced from /api/users/me/watching (same data as
  the Continue Watching bar). Renders nothing when there's nothing in
  progress, so it never leaves an empty shell.
*/

interface WatchingItem {
  tmdbId: number;
  mediaType: string | null;
  title: string;
  posterPath: string | null;
  progressPct: number;
}

export default function JumpBackInRow() {
  const { user } = useAuthStore();
  const { data } = useQuery<WatchingItem[]>({
    queryKey: ["me-watching"],
    queryFn: () => apiFetch("/api/users/me/watching"),
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!data || data.length === 0) return null;

  return (
    <FeedRow title="Jump back in">
      {data.map((it) => (
        <ProgressPosterCard
          key={it.tmdbId}
          tmdbId={it.tmdbId}
          title={it.title}
          posterPath={it.posterPath}
          mediaType={it.mediaType}
          progressPct={it.progressPct}
        />
      ))}
    </FeedRow>
  );
}
