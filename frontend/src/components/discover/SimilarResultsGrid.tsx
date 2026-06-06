"use client";

import Link from "next/link";
import { tmdbImage } from "@/lib/api";

export interface SimilarFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  originalLanguage?: string | null;
  matchScore: number;
  explanation: string;
}

export interface SimilarResponse {
  seed: { tmdbId: number; title: string };
  essence?: string | null;
  results: SimilarFilm[];
  creatorRow?: { label: string; results: SimilarFilm[] } | null;
  total: number;
}

interface Props {
  data?: SimilarResponse;
  loading: boolean;
  /** Display label of the active language filter, e.g. "Tamil". */
  languageLabel?: string;
  /** When provided, a "Fetch" filter button renders in the results header. */
  onOpenFilter?: () => void;
}

/*
  SimilarResultsGrid — essence-reasoned "Movies like X". A clean poster grid
  (poster + match% + title), then a "More from the creator & cast" row.
*/
export default function SimilarResultsGrid({
  data,
  loading,
  languageLabel,
  onOpenFilter,
}: Props) {
  if (loading) {
    return (
      <div className="mt-4">
        <Header title="Reading the film's essence…" />
        <PosterSkeletons />
      </div>
    );
  }

  if (!data) return null;

  if (data.results.length === 0) {
    return (
      <p
        className="text-sm text-center mt-4 rounded-xl p-4"
        style={{
          color: "var(--text-faint)",
          background: "var(--bg-card)",
          border: "1px dashed rgba(255,255,255,0.06)",
        }}
      >
        No close matches for {data.seed.title} yet — try another film.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <Header
        title={`Movies like ${data.seed.title}${
          languageLabel ? ` in ${languageLabel}` : ""
        }`}
        onOpenFilter={onOpenFilter}
      />
      <Grid films={data.results} />

      {data.creatorRow && data.creatorRow.results.length > 0 && (
        <div className="mt-8">
          <Header title={data.creatorRow.label} />
          <Grid films={data.creatorRow.results} />
        </div>
      )}
    </div>
  );
}

function Grid({ films }: { films: SimilarFilm[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {films.map((m) => (
        <PosterCard key={m.tmdbId} film={m} />
      ))}
    </div>
  );
}

function PosterCard({ film: m }: { film: SimilarFilm }) {
  return (
    <Link href={`/film/${m.tmdbId}`} className="group flex flex-col gap-1.5">
      <div
        className="relative aspect-[2/3] rounded-lg overflow-hidden"
        style={{ background: "var(--bg-elevated)" }}
      >
        {m.posterPath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tmdbImage(m.posterPath, "w300")}
            alt={m.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full" style={{ background: "var(--bg-card)" }} />
        )}
        {m.matchScore > 0 && (
          <span
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(10,10,11,0.75)", color: "var(--pill-mood)" }}
          >
            {m.matchScore}%
          </span>
        )}
      </div>
      <p
        className="text-xs font-medium truncate"
        style={{ color: "var(--text-primary)" }}
      >
        {m.title}
      </p>
    </Link>
  );
}

function PosterSkeletons() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[2/3] rounded-lg animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
      ))}
    </div>
  );
}

function Header({
  title,
  onOpenFilter,
}: {
  title: string;
  onOpenFilter?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <h2
        className="display text-xl lg:text-2xl font-bold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      {onOpenFilter && (
        <button
          type="button"
          onClick={onOpenFilter}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-90 active:scale-[0.97]"
          style={{
            background: "rgba(184,149,106,0.15)",
            color: "var(--pill-language)",
            border: "1px solid rgba(184,149,106,0.35)",
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Fetch
        </button>
      )}
    </div>
  );
}
