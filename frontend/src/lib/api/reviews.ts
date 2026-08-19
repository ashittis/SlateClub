import { del, get, post } from "./client";

export interface CommunityReview {
  id: string;
  movieId: string;
  diaryEntryId: string | null;
  body: string;
  spoiler: boolean;
  helpfulCount: number;
  createdAt: string;
  /** The author's rating, so score and writing are read together. */
  rating: number | null;
  author: { id: string; name: string; username: string; avatarUrl: string | null };
}

/**
 * Reviews — writing about a film.
 *
 * A review belongs to the viewing that prompted it, so the usual way one gets
 * written is inside the log sheet. This module covers reading them on a film
 * page and writing one outside of logging.
 */
export const reviewsApi = {
  forFilm: (movieId: string) => get<CommunityReview[]>(`/api/reviews/film/${movieId}`),
  write: (movieId: string, body: string, spoiler = false, diaryEntryId?: string) =>
    post<CommunityReview>("/api/reviews", { movieId, body, spoiler, diaryEntryId }),
  markHelpful: (reviewId: string) =>
    post<{ ok: boolean; helpfulCount: number }>(`/api/reviews/${reviewId}/helpful`),
  remove: (reviewId: string) => del<{ ok: boolean }>(`/api/reviews/${reviewId}`),
};

export const reviewKeys = {
  forFilm: (movieId: string) => ["reviews", "film", movieId] as const,
};
