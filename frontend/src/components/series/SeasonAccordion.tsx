"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import StarRating from "@/components/ratings/StarRating";
import type { SeasonDetail, SeasonSummary, SeriesMyRatings } from "@/types/series";
import EpisodeRow from "./EpisodeRow";

interface Props {
  tmdbId: number;
  season: SeasonSummary;
  myRatings: SeriesMyRatings | undefined;
}

export default function SeasonAccordion({ tmdbId, season, myRatings }: Props) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const n = season.seasonNumber;

  const seasonRating = myRatings?.seasons?.[String(n)] ?? 0;

  const rateMut = useMutation({
    mutationFn: (value: number) =>
      apiFetch(`/api/series/${tmdbId}/season/${n}/rate`, {
        method: "POST",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["series-my-ratings", tmdbId] }),
  });

  const episodesQuery = useQuery<SeasonDetail>({
    queryKey: ["series-season", tmdbId, n],
    queryFn: () => apiFetch(`/api/series/${tmdbId}/season/${n}`),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div
      className="rounded-xl"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <span
            className="text-sm"
            style={{ color: "var(--text-faint)", transform: open ? "rotate(90deg)" : undefined, display: "inline-block", transition: "transform .15s" }}
          >
            ▶
          </span>
          <span
            className="display font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {season.name}
          </span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            {season.episodeCount} eps
          </span>
        </button>
        <StarRating
          value={seasonRating}
          size="sm"
          onChange={(v) => rateMut.mutate(v)}
        />
      </div>

      {open && (
        <div className="space-y-2 p-3 pt-0">
          {episodesQuery.isLoading ? (
            <p className="py-4 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              Loading episodes…
            </p>
          ) : (
            (episodesQuery.data?.episodes ?? []).map((ep) => {
              const key = `${n}:${ep.episodeNumber}`;
              return (
                <EpisodeRow
                  key={ep.episodeNumber}
                  tmdbId={tmdbId}
                  seasonNumber={n}
                  episode={ep}
                  rating={myRatings?.episodes?.[key] ?? null}
                  reaction={myRatings?.reactions?.[key] ?? null}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
