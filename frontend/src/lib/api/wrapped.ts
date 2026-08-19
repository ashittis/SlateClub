import { get } from "./client";
import type { FilmCard } from "./films";

export interface RatedFilm extends FilmCard {
  rating: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface ShareCard {
  period?: "month" | "year";
  year: number;
  month?: number | null;
  label?: string;
  user: { name: string; username: string; avatarUrl: string | null };
  viewings: number;
  /** Distinct films — diverges from `viewings` on every rewatch. */
  films: number;
  hours?: number;
  filmsMissingRuntime?: number;
  theatreVisits?: number;
  rewatches?: number;
  averageRating?: number | null;
  streak?: number;
  mostRewatched?: (FilmCard & { views: number }) | null;
  topRated?: RatedFilm[];
  favouriteFilm?: RatedFilm | null;
  topGenres?: NamedCount[];
  topDirector?: NamedCount | null;
  topActor?: NamedCount | null;
  firstFilm?: (FilmCard & { watchedOn: string }) | null;
  lastFilm?: (FilmCard & { watchedOn: string }) | null;
}

/**
 * Passport sharing — the payoff for keeping a diary (KASET.md §8).
 *
 * All three read the same computation, so a card can never disagree with the
 * story it came from.
 */
export const wrappedApi = {
  years: () => get<{ years: number[] }>("/api/wrapped/years"),
  year: (year: number) => get<ShareCard>(`/api/wrapped/${year}`),
  yearCard: (year: number) => get<ShareCard>(`/api/wrapped/share/year/${year}`),
  monthCard: (year: number, month: number) =>
    get<ShareCard>(`/api/wrapped/share/month/${year}/${month}`),
};

export const wrappedKeys = {
  years: () => ["wrapped", "years"] as const,
  year: (year: number) => ["wrapped", year] as const,
  card: (period: string, year: number, month?: number) =>
    ["wrapped", "card", period, year, month ?? 0] as const,
};
