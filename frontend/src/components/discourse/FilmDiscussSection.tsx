"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import HotTakeComposer from "./HotTakeComposer";
import HotTakeCard from "./HotTakeCard";
import PollCard from "./PollCard";
import type { HotTake, Poll } from "@/types/discourse";

interface Props {
  tmdbId: number;
}

/*
  FilmDiscussSection — the Discuss tab content for a film page.
  Hot Takes scoped to this tmdb_id + any polls also targeting it.
  Spoiler-gating arrives in P3 once tone-tag classification lands.
*/
export default function FilmDiscussSection({ tmdbId }: Props) {
  const takes = useQuery<{ items: HotTake[] }>({
    queryKey: ["hot-takes", "film", tmdbId],
    queryFn: () => apiFetch(`/api/hot-takes?tmdbId=${tmdbId}`),
    refetchInterval: 30_000,
  });

  const polls = useQuery<{ items: Poll[] }>({
    queryKey: ["polls", "film", tmdbId],
    queryFn: () => apiFetch(`/api/polls?tmdbId=${tmdbId}`),
  });

  return (
    <section
      className="space-y-3 border-t pt-5"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <h3
        className="display text-base font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Discuss
      </h3>

      <HotTakeComposer
        tmdbId={tmdbId}
        invalidateKey={["hot-takes", "film", tmdbId]}
        placeholder="Share a take on this film…"
      />

      {polls.data?.items?.map((p) => <PollCard key={p.id} poll={p} />)}

      {takes.isLoading && (
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          Loading takes…
        </p>
      )}
      {takes.data && takes.data.items.length === 0 && (
        <p
          className="text-sm rounded-xl p-5 text-center"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          No takes yet on this film. Be the first.
        </p>
      )}
      {takes.data?.items.map((t) => <HotTakeCard key={t.id} take={t} />)}
    </section>
  );
}
