import { del, get, post } from "./client";
import type { FilmCard } from "./films";

export interface RatedFilm extends FilmCard {
  id: string;
  rating: number;
  ratedAt: string;
}

export interface WatchlistFilm extends FilmCard {
  id: string;
  note: string | null;
  addedAt: string;
}

export interface MyReview extends FilmCard {
  id: string;
  movieId: string;
  diaryEntryId: string | null;
  body: string;
  spoiler: boolean;
  helpfulCount: number;
  createdAt: string;
  rating: number | null;
}

/**
 * Your Library — the personal cinema record (KASET.md §8).
 *
 * A view over things other slices own: the diary owns viewings, ratings owns
 * opinions, reviews owns writing, watchlist owns intent. Nothing new is stored
 * for the Library itself.
 */
export const libraryApi = {
  ratings: () => get<RatedFilm[]>("/api/ratings"),
  clearRating: (movieId: string) => del<{ ok: boolean }>(`/api/ratings/${movieId}`),

  watchlist: () => get<WatchlistFilm[]>("/api/watchlist"),
  addToWatchlist: (movieId: string, note?: string) =>
    post<{ ok: boolean }>("/api/watchlist", { movieId, note }),
  removeFromWatchlist: (movieId: string) =>
    del<{ ok: boolean }>(`/api/watchlist/${movieId}`),

  reviews: () => get<MyReview[]>("/api/reviews/mine"),
  deleteReview: (reviewId: string) => del<{ ok: boolean }>(`/api/reviews/${reviewId}`),
};

export const libraryKeys = {
  ratings: () => ["library", "ratings"] as const,
  watchlist: () => ["library", "watchlist"] as const,
  reviews: () => ["library", "reviews"] as const,
};
