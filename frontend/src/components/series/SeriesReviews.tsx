"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface ReviewItem {
  id: string;
  user_id: string;
  movie_id: string;
  season_number: number;
  body: string;
  spoiler: boolean;
  helpful_count: number;
  user: { id: string; name: string; username: string; avatar_url: string | null } | null;
}

interface Props {
  /** internal movies.id of the series */
  movieId: string;
  /** number of seasons, for the season selector */
  numberOfSeasons: number | null;
}

/*
  Series + season reviews (no episode reviews, per gptplan). A scope selector
  switches between the whole-series review and each season's reviews.
*/
export default function SeriesReviews({ movieId, numberOfSeasons }: Props) {
  const qc = useQueryClient();
  const [season, setSeason] = useState(0); // 0 = whole series
  const [draft, setDraft] = useState("");

  const reviews = useQuery<ReviewItem[]>({
    queryKey: ["series-reviews", movieId, season],
    queryFn: () =>
      apiFetch(`/api/reviews/movie/${movieId}?season=${season}&sort=helpful`),
    enabled: !!movieId,
  });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch("/api/reviews/", {
        method: "POST",
        body: JSON.stringify({
          movie_id: movieId,
          body: draft.trim(),
          season_number: season,
        }),
      }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["series-reviews", movieId, season] });
    },
  });

  const scopes = [
    { n: 0, label: "Whole series" },
    ...Array.from({ length: numberOfSeasons ?? 0 }, (_, i) => ({
      n: i + 1,
      label: `Season ${i + 1}`,
    })),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {scopes.map((s) => {
          const on = season === s.n;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => setSeason(s.n)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer"
              style={{
                background: on ? "var(--text-primary)" : "var(--bg-card)",
                color: on ? "var(--bg-screening)" : "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mb-6">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={
            season === 0
              ? "Review the whole series…"
              : `Review Season ${season}…`
          }
          className="w-full resize-none rounded-xl p-3 text-sm outline-none"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        <button
          type="button"
          onClick={() => draft.trim() && submit.mutate()}
          disabled={!draft.trim() || submit.isPending}
          className="mt-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          style={{ background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" }}
        >
          {submit.isPending ? "Posting…" : "Post review"}
        </button>
      </div>

      {reviews.isLoading ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
      ) : (reviews.data ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          No reviews yet — be the first.
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.data!.map((r) => (
            <div
              key={r.id}
              className="rounded-xl p-3"
              style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                @{r.user?.username ?? "user"}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                {r.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
