"use client";

import Link from "next/link";
import { tmdbImage } from "@/lib/api";
import type { Movie } from "@/types/movie";
import StarRating from "@/components/ratings/StarRating";
import { titleHref } from "@/lib/titleHref";
import { shelfReasonSummary } from "@/lib/shelfReasons";
import { timeAgo, diaryDayParts } from "@/lib/profileFormat";

/* ---------- Shared library-row types ---------- */

export interface RatedMovie extends Movie {
  userRating: number;
  ratedAt?: string | null;
}
export interface WatchedMovie extends Movie {
  watchedAt?: string | null;
}
export interface ShelfMovie extends Movie {
  reasonType: string | null;
  reasonReference: string | null;
  note: string | null;
  addedAt: string;
}
export interface DnfMovie extends Movie {
  reason: string | null;
  stoppedAt: string | null;
  progressPct: number | null;
}
export interface WatchingMovie extends Movie {
  progressPct: number;
  startedAt: string;
}
export interface DiaryEntryMovie extends Movie {
  entryId: string;
  watchedAt: string | null;
  rating: number | null;
  isRewatch: boolean;
  atTheatre: boolean;
  visibility: "public" | "private";
}

/* ---------- Skeletons ---------- */

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-lg bg-glass-8" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-glass-8" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <div className="w-10 h-14 animate-pulse rounded bg-glass-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-48 animate-pulse rounded bg-glass-8" />
            <div className="h-3 w-24 animate-pulse rounded bg-glass-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Row + poster building blocks ---------- */

/** List-style film row — used by Watched / Ratings / Diary tabs. */
export function FilmRow({
  movie,
  dateLabel,
  rating,
}: {
  movie: Movie;
  dateLabel?: string | null;
  rating?: number | null;
}) {
  return (
    <Link
      href={titleHref(movie.tmdbId, movie.mediaType)}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-glass-6 group"
    >
      <div className="w-10 shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-md" style={{ background: "var(--bg-elevated)" }}>
          {movie.posterPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tmdbImage(movie.posterPath, "w200")}
              alt={movie.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {movie.title}
        </p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          {movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : ""}
        </p>
        {rating != null && (
          <div className="mt-0.5">
            <StarRating value={rating} readonly size="sm" />
          </div>
        )}
      </div>
      {dateLabel && (
        <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
          {dateLabel}
        </span>
      )}
    </Link>
  );
}

/** Diary row — one viewing, with a DAY/MON stamp and venue/rewatch/privacy
 * badges. Distinct from FilmRow because each rewatch is its own dated line. */
export function DiaryRow({ entry }: { entry: DiaryEntryMovie }) {
  const parts = entry.watchedAt ? diaryDayParts(entry.watchedAt) : null;
  return (
    <Link
      href={titleHref(entry.tmdbId, entry.mediaType)}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-glass-6 group"
    >
      {parts && (
        <div className="w-9 shrink-0 text-center leading-none">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{parts.day}</div>
          <div className="text-[10px] tracking-wide" style={{ color: "var(--text-faint)" }}>{parts.month}</div>
        </div>
      )}
      <div className="w-10 shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-md" style={{ background: "var(--bg-elevated)" }}>
          {entry.posterPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tmdbImage(entry.posterPath, "w200")} alt={entry.title} className="h-full w-full object-cover" loading="lazy" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{entry.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {entry.rating != null && <StarRating value={entry.rating} readonly size="sm" />}
          {entry.releaseDate && (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {new Date(entry.releaseDate).getFullYear()}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" style={{ color: "var(--text-faint)" }}>
        {entry.atTheatre && (
          <span title="Theatre visit" aria-label="Theatre visit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" style={{ color: "var(--cta-primary, #FF9408)" }}>
              <path d="M4 6h16a1 1 0 011 1v3a2 2 0 000 4v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a2 2 0 000-4V7a1 1 0 011-1z" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {entry.isRewatch && (
          <span title="Rewatch" aria-label="Rewatch">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
              <path d="M4 9a8 8 0 0113.5-3.5L20 8M20 4v4h-4M20 15a8 8 0 01-13.5 3.5L4 16M4 20v-4h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {entry.visibility === "private" && (
          <span title="Private" aria-label="Private">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </div>
    </Link>
  );
}

/** Poster tile for shelf/grid views. */
export function PosterLink({ movie, children }: { movie: Movie; children?: React.ReactNode }) {
  return (
    <Link href={titleHref(movie.tmdbId, movie.mediaType)} className="group flex flex-col gap-2">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-glass-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tmdbImage(movie.posterPath, "w300")}
          alt={movie.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="space-y-0.5 px-0.5">
        <h3 className="truncate text-sm font-medium text-text-primary">{movie.title}</h3>
        {children}
      </div>
    </Link>
  );
}

export function ShelfCard({ movie }: { movie: ShelfMovie }) {
  const because = shelfReasonSummary(movie.reasonType, movie.reasonReference);
  return (
    <PosterLink movie={movie}>
      {movie.note && (
        <p className="text-xs italic leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>
          &ldquo;{movie.note}&rdquo;
        </p>
      )}
      {because && <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>{because}</p>}
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>Added {timeAgo(movie.addedAt)}</p>
    </PosterLink>
  );
}
