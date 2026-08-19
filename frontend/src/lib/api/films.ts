import { del, get, post } from "./client";
// Type-only, so the diary ↔ films cycle is erased at build time.
import type { WatchType } from "./diary";

export interface FilmCard {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: string | null;
  voteAverage?: number | null;
}

export interface Person {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  character?: string | null;
}

export interface FilmDetail extends FilmCard {
  id: string;
  overview: string | null;
  runtime: number | null;
  genres: string[];
  directors: Person[];
  cast: Person[];
  voteCount: number | null;
  backdropPath: string | null;
  originalLanguage: string | null;
}

export interface FilmStatus {
  filmId: string;
  inWatchlist: boolean;
  watchlistNote: string | null;
  watching: { progressPct: number; startedAt: string } | null;
  rating: number | null;
  hasReview: boolean;
  logCount: number;
  /** True once any viewing exists — drives the rewatch default in the log sheet. */
  seen: boolean;
}

/**
 * One row of your own history with a film, from `/api/films/{id}/viewings`.
 *
 * These names are the endpoint's, verified against it. An earlier version of
 * this interface declared `watchedAt` and `atTheatre`, which the endpoint has
 * never sent — the type asserted a shape rather than validating one, so the
 * mismatch typechecked cleanly and only failed at runtime.
 */
export interface Viewing {
  id: string;
  /** Calendar date, YYYY-MM-DD. */
  watchedOn: string;
  rating: number | null;
  liked: boolean;
  isRewatch: boolean;
  watchType: WatchType;
  theatreName: string | null;
  tags: string[];
  visibility: string;
  reviewId: string | null;
}

export interface PersonDetail {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  biography: string | null;
  knownFor: string | null;
  films: FilmCard[];
}

/**
 * Films — the central content object.
 *
 * Everything is addressed by **TMDB id**, so a film can be acted on straight
 * from a search result. Logging is not here: it belongs to `diaryApi`, because
 * the diary is the single writer for viewings.
 */
export const filmsApi = {
  search: (q: string) =>
    get<{ results: FilmCard[] }>(`/api/films/search?q=${encodeURIComponent(q)}`),
  trending: () => get<{ results: FilmCard[] }>("/api/films/trending"),
  popular: () => get<{ results: FilmCard[] }>("/api/films/popular"),

  detail: (tmdbId: number) => get<FilmDetail>(`/api/films/${tmdbId}`),
  status: (tmdbId: number) => get<FilmStatus>(`/api/films/${tmdbId}/status`),
  viewings: (tmdbId: number) =>
    get<{ viewings: Viewing[] }>(`/api/films/${tmdbId}/viewings`),

  addToWatchlist: (tmdbId: number, note?: string) =>
    post<{ ok: boolean }>(`/api/films/${tmdbId}/watchlist`, note ? { note } : {}),
  removeFromWatchlist: (tmdbId: number) =>
    del<{ ok: boolean }>(`/api/films/${tmdbId}/watchlist`),

  /** 0 clears the rating rather than storing a zero. */
  rate: (tmdbId: number, rating: number) =>
    post<{ ok: boolean; rating: number | null }>(`/api/films/${tmdbId}/rate`, { rating }),

  person: (personId: number) => get<PersonDetail>(`/api/films/people/${personId}`),
};

export const filmKeys = {
  detail: (tmdbId: number) => ["film", tmdbId] as const,
  status: (tmdbId: number) => ["film", tmdbId, "status"] as const,
  viewings: (tmdbId: number) => ["film", tmdbId, "viewings"] as const,
  search: (q: string) => ["films", "search", q] as const,
  person: (id: number) => ["person", id] as const,
};

/** `/film/157336-interstellar` → 157336. The slug tail is decorative. */
export function tmdbIdFromSlug(slug: string): number {
  return Number.parseInt(slug.split("-")[0] ?? "", 10);
}

export function filmHref(film: { tmdbId: number; title: string }): string {
  const slug = film.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `/film/${film.tmdbId}${slug ? `-${slug}` : ""}`;
}
