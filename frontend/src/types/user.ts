export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  onboarded: boolean;
}

export interface PublicProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  ratings_count: number;
  watchlist_count: number;
  watched_count: number;
  reviews_count: number;
  followers_count: number;
  following_count: number;
}

export interface TwinScore {
  score: number; // 0..1
  isSelf: boolean;
  overlapCount: number;
  highRatedOverlap?: number;
}

export interface MutualTwin {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface FilmCardLite {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate?: string | null;
}
