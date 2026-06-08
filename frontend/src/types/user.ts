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

// ── Match Cut (taste compatibility) ──────────────────────────

export interface TasteMatch {
  score: number; // 0..1 cosine of taste vectors
  sharedFavorites: FilmCardLite[];
  disagreements: FilmCardLite[];
  targetRatedCount: number;
  username?: string;
  name?: string;
  avatarUrl?: string | null;
}

export interface MatchCutMember {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export interface MatchCutItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  groupScore: number; // 0..1
  perMember: { userId: string; username: string; score: number }[];
}

export interface MatchCutResult {
  members: MatchCutMember[];
  items: MatchCutItem[];
}

export interface MatchCutSummary {
  id: string;
  title: string;
  memberCount: number;
  isCreator: boolean;
  createdAt: string;
}

export interface MatchCutDetail {
  id: string;
  title: string;
  inviteToken: string;
  isCreator: boolean;
  isMember: boolean;
  members: MatchCutMember[];
  items: MatchCutItem[];
}
