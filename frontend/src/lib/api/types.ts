/** Shapes the API returns. Kept next to the domain modules that produce them. */

export interface FilmSummary {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: string | null;
}

export interface PersonSummary {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  department: string | null;
  knownFor: string[];
}

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

/** How a viewing happened. Mirrors the backend enum. */
export type WatchType = "theatre" | "streaming" | "tv" | "other";

export interface DiaryEntry {
  id: string;
  watchedAt: string;
  rating: number | null;
  isRewatch: boolean;
  atTheatre: boolean;
  visibility: "public" | "private";
  movie: FilmSummary;
}

export interface UnreadCount {
  count: number;
}
