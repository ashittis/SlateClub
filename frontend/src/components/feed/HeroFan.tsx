"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import CardStack from "@/components/ui/CardStack";
import Pill from "@/components/ui/Pill";
import { apiFetch, tmdbImage } from "@/lib/api";

export interface HeroFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  originalLanguage: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[] | null;
}

export interface HeroData {
  hero: HeroFilm | null;
  stack: { tmdbId: number; title: string; posterPath: string | null }[];
  explanation: string | null;
}

interface Props {
  data: HeroData;
}

export default function HeroFan({ data }: Props) {
  const qc = useQueryClient();
  const { hero, stack, explanation } = data;

  const dislikeMut = useMutation({
    mutationFn: (tmdbId: number) =>
      apiFetch("/api/feedback/micro", {
        method: "POST",
        body: JSON.stringify({ movieId: tmdbId, type: "not_in_mood" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hero-feed"] }),
  });

  const watchlistMut = useMutation({
    mutationFn: (tmdbId: number) =>
      apiFetch(`/api/movies/${tmdbId}/watchlist`, { method: "POST" }),
  });

  const watchedMut = useMutation({
    mutationFn: (tmdbId: number) =>
      apiFetch(`/api/movies/${tmdbId}/watched`, { method: "POST" }),
  });

  if (!hero) return null;

  const heroPoster = hero.posterPath ? tmdbImage(hero.posterPath, "w500") : "";
  const stackPosters = stack
    .map((s) => (s.posterPath ? tmdbImage(s.posterPath, "w300") : ""))
    .filter(Boolean);

  // CardStack `fan` variant uses [left, right, focused] ordering.
  const posters = [
    stackPosters[0] || heroPoster,
    stackPosters[1] || heroPoster,
    heroPoster,
  ];

  const year = hero.releaseDate ? hero.releaseDate.slice(0, 4) : null;

  return (
    <section className="flex flex-col items-center pb-6">
      <Link
        href={`/film/${hero.tmdbId}`}
        className="block"
        aria-label={`Open ${hero.title}`}
      >
        <CardStack posters={posters} variant="fan" size="md" alt={hero.title} />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mt-5 text-center max-w-md px-4"
      >
        <h2
          className="display text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {hero.title}
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {[year, hero.originalLanguage?.toUpperCase(), hero.runtime ? `${hero.runtime}m` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {hero.genres && hero.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {hero.genres.slice(0, 3).map((g) => (
              <Pill key={g.id} kind="genre" interactive={false} size="sm">
                {g.name}
              </Pill>
            ))}
          </div>
        )}

        {explanation && (
          <p
            className="mt-3 text-xs italic"
            style={{ color: "var(--text-faint)" }}
          >
            {explanation}
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <ActionButton
            label="Dislike"
            disabled={dislikeMut.isPending}
            onClick={() => dislikeMut.mutate(hero.tmdbId)}
          />
          <ActionButton
            label="+ Shelf"
            primary
            disabled={watchlistMut.isPending}
            onClick={() => watchlistMut.mutate(hero.tmdbId)}
          />
          <ActionButton
            label="✓ Watched"
            disabled={watchedMut.isPending}
            onClick={() => watchedMut.mutate(hero.tmdbId)}
          />
        </div>
      </motion.div>
    </section>
  );
}

function ActionButton({
  label,
  primary,
  disabled,
  onClick,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-full text-xs font-semibold transition-opacity disabled:opacity-50"
      style={{
        background: primary ? "var(--cta-primary)" : "var(--bg-elevated)",
        color: primary ? "var(--bg-screening)" : "var(--text-primary)",
        border: primary
          ? "1px solid transparent"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {label}
    </button>
  );
}
