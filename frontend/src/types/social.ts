export interface Review {
  id: string;
  userId: string;
  movieId: string;
  body: string;
  spoiler: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
  };
  _count?: { comments: number };
}

export interface Comment {
  id: string;
  userId: string;
  reviewId: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface FollowUser {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  type: "rated" | "reviewed" | "watched" | "watchlisted" | "followed";
  movieId: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
  };
  movie?: {
    id: string;
    title: string;
    tmdbId: number;
    posterPath: string | null;
  } | null;
}

export type MicroFeedbackType =
  | "not_in_mood"
  | "too_slow"
  | "too_intense"
  | "seen_similar"
  | "not_for_me"
  | "more_like_this";

export interface CalibrationPair {
  filmA: {
    id: string;
    tmdbId: number;
    title: string;
    posterPath: string | null;
    genres: { id: number; name: string }[] | null;
  };
  filmB: {
    id: string;
    tmdbId: number;
    title: string;
    posterPath: string | null;
    genres: { id: number; name: string }[] | null;
  };
}

export interface CalibrationStatus {
  active: boolean;
  ratingCount: number;
  daysSinceSignup: number;
  responsesGiven: number;
}
