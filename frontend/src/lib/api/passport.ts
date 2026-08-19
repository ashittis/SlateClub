import { get, patch } from "./client";
import type { FilmCard } from "./films";
import type { WatchType } from "./diary";

export interface PassportStats {
  period: "all" | "year" | "month";
  year: number | null;
  month: number | null;
  viewings: number;
  /** Distinct films — differs from `viewings` whenever there are rewatches. */
  films: number;
  theatreVisits: number;
  rewatches: number;
  averageRating: number | null;
  ratedCount: number;
  hoursWatched: number;
  ratings: number;
  reviews: number;
  watchlist: number;
  followers: number;
  following: number;
}

export interface FavouriteFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

export interface FavouritePerson {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  knownFor: string;
}

export interface Passport {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  joinedAt: string;
  isOwner: boolean;
  stats: PassportStats;
  favouriteFilms: FavouriteFilm[];
  favouritePeople: FavouritePerson[];
  years: number[];
}

export interface TopPerson {
  tmdbId: number;
  name: string | null;
  profilePath: string | null;
  count: number;
}

export interface PeriodStats extends Omit<PassportStats, "ratings" | "reviews" | "watchlist" | "followers" | "following"> {
  topPeople: { directors: TopPerson[]; actors: TopPerson[] };
  topFilms: (FilmCard & { rating: number; watchedOn: string })[];
}

export interface PassportDiaryEntry extends FilmCard {
  entryId: string;
  watchedOn: string;
  rating: number | null;
  isRewatch: boolean;
  watchType: WatchType;
}

export interface PassportReview extends FilmCard {
  reviewId: string;
  body: string;
  spoiler: boolean;
  createdAt: string;
}

/**
 * The Kaset Passport — a user's cinematic identity (KASET.md §8).
 *
 * `me` and `byUsername` return the same shape, so one component renders both.
 * Privacy is enforced server-side: a viewer who isn't the owner never receives
 * private viewings, and the stats are computed to match.
 */
export const passportApi = {
  me: () => get<Passport>("/api/passport/me"),
  byUsername: (username: string) => get<Passport>(`/api/passport/${username}`),
  update: (changes: Partial<Pick<Passport, "name" | "username" | "bio" | "city" | "country">>) =>
    patch<Passport>("/api/passport/me", changes),

  stats: (username: string, period: "all" | "year" | "month" = "all", year?: number, month?: number) => {
    const q = new URLSearchParams({ period });
    if (year) q.set("year", String(year));
    if (month) q.set("month", String(month));
    return get<PeriodStats>(`/api/passport/${username}/stats?${q}`);
  },

  diary: (username: string, limit = 24) =>
    get<PassportDiaryEntry[]>(`/api/passport/${username}/diary?limit=${limit}`),
  reviews: (username: string) => get<PassportReview[]>(`/api/passport/${username}/reviews`),
  watchlist: (username: string) => get<FilmCard[]>(`/api/passport/${username}/watchlist`),
};

export const passportKeys = {
  me: () => ["passport", "me"] as const,
  user: (username: string) => ["passport", username] as const,
  stats: (username: string, period: string, year?: number, month?: number) =>
    ["passport", username, "stats", period, year ?? 0, month ?? 0] as const,
  diary: (username: string) => ["passport", username, "diary"] as const,
  reviews: (username: string) => ["passport", username, "reviews"] as const,
};
