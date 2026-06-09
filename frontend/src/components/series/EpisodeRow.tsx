"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { Episode } from "@/types/series";
import NumericRating from "./NumericRating";
import EpisodeReactionPicker from "./EpisodeReactionPicker";

interface Props {
  tmdbId: number;
  seasonNumber: number;
  episode: Episode;
  rating: number | null;
  reaction: string | null;
}

export default function EpisodeRow({
  tmdbId,
  seasonNumber,
  episode,
  rating,
  reaction,
}: Props) {
  const qc = useQueryClient();
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["series-my-ratings", tmdbId] });
  const base = `/api/series/${tmdbId}/season/${seasonNumber}/episode/${episode.episodeNumber}`;

  const rateMut = useMutation({
    mutationFn: (value: number | null) =>
      apiFetch(`${base}/rate`, {
        method: "POST",
        body: JSON.stringify({ value: value ?? 0 }),
      }),
    onSuccess: refresh,
  });
  const reactMut = useMutation({
    mutationFn: (r: string | null) =>
      apiFetch(`${base}/reaction`, {
        method: "POST",
        body: JSON.stringify({ reaction: r }),
      }),
    onSuccess: refresh,
  });

  return (
    <div
      className="flex gap-3 rounded-lg p-2"
      style={{ background: "var(--bg-card)" }}
    >
      <div
        className="hidden sm:block w-24 shrink-0 aspect-video overflow-hidden rounded"
        style={{ background: "var(--bg-elevated)" }}
      >
        {episode.stillPath && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tmdbImage(episode.stillPath, "w300")}
            alt={episode.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="truncate text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            E{episode.episodeNumber} · {episode.name}
          </p>
          {episode.community != null && episode.community > 0 && (
            <span
              className="shrink-0 text-xs"
              style={{ color: "var(--text-faint)" }}
            >
              Community {episode.community.toFixed(1)}
            </span>
          )}
        </div>
        {episode.overview && (
          <p
            className="mt-0.5 line-clamp-2 text-xs"
            style={{ color: "var(--text-faint)" }}
          >
            {episode.overview}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Your rating
            </span>
            <NumericRating
              value={rating}
              onChange={(v) => rateMut.mutate(v)}
            />
          </div>
          <EpisodeReactionPicker
            value={reaction}
            onChange={(r) => reactMut.mutate(r)}
          />
        </div>
      </div>
    </div>
  );
}
