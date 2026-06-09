"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { Series, SeriesMyRatings } from "@/types/series";
import Button from "@/components/ui/Button";
import StarRating from "@/components/ratings/StarRating";
import ShelfNoteSheet, { type ShelfNotePayload } from "@/components/film/ShelfNoteSheet";
import DNFSheet, { type DnfPayload } from "@/components/film/DNFSheet";
import SeasonAccordion from "@/components/series/SeasonAccordion";
import SeriesReviews from "@/components/series/SeriesReviews";
import AddToSlateSheet from "@/components/slates/AddToSlateSheet";
import { addRecentlyViewed } from "@/lib/searchHistory";

interface SeriesStatus {
  mediaType: string;
  inWatchlist: boolean;
  watching: { progressPct: number; startedAt: string } | null;
  watched: boolean;
  dnf: { reason: string | null; stoppedAt: string | null } | null;
  rating: number | null;
}

type Tab = "overview" | "episodes" | "reviews" | "similar";

const TV = "?mediaType=tv";

export default function SeriesDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [shelfOpen, setShelfOpen] = useState(false);
  const [dnfOpen, setDnfOpen] = useState(false);
  const [slateOpen, setSlateOpen] = useState(false);

  const { data: series, isLoading, error } = useQuery<Series>({
    queryKey: ["series", slug],
    queryFn: () => apiFetch<Series>(`/api/series/${slug}`),
    enabled: !!slug,
  });

  // Record for the search page's "Recently viewed".
  useEffect(() => {
    if (series)
      addRecentlyViewed({
        tmdbId: series.tmdbId,
        mediaType: "tv",
        title: series.title,
        posterPath: series.posterPath,
        year: series.releaseDate?.slice(0, 4) ?? null,
        numberOfSeasons: series.numberOfSeasons,
      });
  }, [series?.tmdbId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: status } = useQuery<SeriesStatus>({
    queryKey: ["seriesStatus", slug],
    queryFn: () => apiFetch<SeriesStatus>(`/api/movies/${slug}/status${TV}`),
    enabled: !!slug,
  });

  const { data: myRatings } = useQuery<SeriesMyRatings>({
    queryKey: ["series-my-ratings", Number(slug)],
    queryFn: () => apiFetch<SeriesMyRatings>(`/api/series/${slug}/my-ratings`),
    enabled: !!slug,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["seriesStatus", slug] });
    qc.invalidateQueries({ queryKey: ["series-my-ratings", Number(slug)] });
    qc.invalidateQueries({ queryKey: ["profile", "watchlist"] });
    qc.invalidateQueries({ queryKey: ["profile", "dnf"] });
  };

  const rateMut = useMutation({
    mutationFn: (rating: number) =>
      apiFetch(`/api/movies/${slug}/rate${TV}`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      }),
    onSuccess: refresh,
  });
  const shelfMut = useMutation({
    mutationFn: (payload: ShelfNotePayload) =>
      apiFetch(`/api/movies/${slug}/watchlist${TV}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setShelfOpen(false);
      refresh();
    },
  });
  const unshelfMut = useMutation({
    mutationFn: () => apiFetch(`/api/movies/${slug}/watchlist${TV}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const watchingMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/movies/${slug}/watching${TV}`, {
        method: status?.watching ? "DELETE" : "POST",
      }),
    onSuccess: refresh,
  });
  const watchedMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/movies/${slug}/watched${TV}`, {
        method: status?.watched ? "DELETE" : "POST",
      }),
    onSuccess: refresh,
  });
  const dnfMut = useMutation({
    mutationFn: (payload: DnfPayload) =>
      apiFetch(`/api/movies/${slug}/dnf${TV}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setDnfOpen(false);
      refresh();
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse px-4 pt-6">
        <div className="h-64 w-full rounded-2xl bg-glass-8" />
      </div>
    );
  }
  if (error || !series) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <p className="text-glass-40">Series not found</p>
      </div>
    );
  }

  const year = series.releaseDate ? series.releaseDate.slice(0, 4) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 pt-6 pb-24">
      {/* Hero */}
      <div className="flex gap-5">
        <div
          className="w-28 sm:w-40 shrink-0 aspect-[2/3] overflow-hidden rounded-xl"
          style={{ background: "var(--bg-elevated)" }}
        >
          {series.posterPath && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tmdbImage(series.posterPath, "w500")}
              alt={series.title}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="display text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {series.title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {[
              year,
              series.originalLanguage?.toUpperCase(),
              series.numberOfSeasons ? `${series.numberOfSeasons} season${series.numberOfSeasons > 1 ? "s" : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-3">
            <StarRating
              size="lg"
              value={status?.rating ?? 0}
              onChange={(r) => rateMut.mutate(r)}
            />
          </div>

          {/* Action bar */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant={status?.inWatchlist ? "primary" : "secondary"}
              onClick={() => (status?.inWatchlist ? unshelfMut.mutate() : setShelfOpen(true))}
              disabled={unshelfMut.isPending}
            >
              {status?.inWatchlist ? "✓ Shelved" : "Shelf"}
            </Button>
            <Button
              variant={status?.watching ? "primary" : "secondary"}
              onClick={() => watchingMut.mutate()}
              disabled={watchingMut.isPending}
            >
              {status?.watching ? "Watching…" : "Start Watching"}
            </Button>
            <Button
              variant={status?.watched ? "primary" : "secondary"}
              onClick={() => watchedMut.mutate()}
              disabled={watchedMut.isPending}
            >
              {status?.watched ? "Watched" : "Mark Watched"}
            </Button>
            <Button variant="secondary" onClick={() => setSlateOpen(true)}>
              Add to Slate
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setDnfOpen(true)}
            className="mt-2 text-xs transition-opacity hover:opacity-80 cursor-pointer"
            style={{ color: "var(--text-faint)" }}
          >
            {status?.dnf ? "Marked as didn’t finish · edit" : "Didn’t finish?"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 mb-4 flex gap-1 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {(["overview", "episodes", "reviews", "similar"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="relative px-4 py-2.5 text-sm font-medium capitalize transition-colors cursor-pointer"
            style={{
              color: tab === t ? "var(--text-primary)" : "var(--text-faint)",
              borderBottom: tab === t ? "2px solid var(--cta-primary)" : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {series.overview && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {series.overview}
            </p>
          )}
          {series.credits?.cast && series.credits.cast.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Cast</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {series.credits.cast.slice(0, 12).map((c) => (
                  <div key={c.id} className="text-center">
                    <div className="aspect-[2/3] overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                      {c.profile_path && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={tmdbImage(c.profile_path, "w200")} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "episodes" && (
        <div className="space-y-3">
          {series.seasons.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>No seasons listed.</p>
          ) : (
            series.seasons.map((s) => (
              <SeasonAccordion key={s.seasonNumber} tmdbId={Number(slug)} season={s} myRatings={myRatings} />
            ))
          )}
        </div>
      )}

      {tab === "reviews" && (
        <SeriesReviews movieId={series.id} numberOfSeasons={series.numberOfSeasons} />
      )}

      {tab === "similar" && (
        <p className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>
          Similar series & films are coming soon.
        </p>
      )}

      <ShelfNoteSheet
        open={shelfOpen}
        title={series.title}
        onClose={() => setShelfOpen(false)}
        onSubmit={(p) => shelfMut.mutate(p)}
        pending={shelfMut.isPending}
      />
      <DNFSheet
        open={dnfOpen}
        title={series.title}
        onClose={() => setDnfOpen(false)}
        onSubmit={(p) => dnfMut.mutate(p)}
        pending={dnfMut.isPending}
      />
      <AddToSlateSheet
        open={slateOpen}
        onClose={() => setSlateOpen(false)}
        tmdbId={Number(slug)}
        mediaType="tv"
        title={series.title}
      />
    </div>
  );
}
