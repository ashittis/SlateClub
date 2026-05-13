"use client";

import Link from "next/link";
import { tmdbImage } from "@/lib/api";
import type { SlateFilm } from "@/types/slates";

interface Props {
  film: SlateFilm;
  onRemove?: () => void;
}

export default function SlateFilmRow({ film, onRemove }: Props) {
  return (
    <div
      className="flex items-start gap-4 rounded-xl p-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <Link
        href={`/film/${film.tmdbId}`}
        className="shrink-0 block w-16 aspect-[2/3] rounded-lg overflow-hidden"
        style={{ background: "var(--bg-elevated)" }}
      >
        {film.posterPath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tmdbImage(film.posterPath, "w200")}
            alt={film.title ?? ""}
            className="w-full h-full object-cover"
          />
        ) : null}
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/film/${film.tmdbId}`}
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {film.title ?? `tmdb:${film.tmdbId}`}
        </Link>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
          {[
            film.releaseDate?.slice(0, 4),
            film.originalLanguage?.toUpperCase(),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {film.note && (
          <p
            className="text-sm mt-2 italic leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            &ldquo;{film.note}&rdquo;
          </p>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-xs px-2 py-1 rounded-md"
          style={{ color: "var(--text-faint)" }}
        >
          Remove
        </button>
      )}
    </div>
  );
}
