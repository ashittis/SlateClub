export interface DiscourseUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export type ReactionKind = "like" | "agree" | "disagree";

export interface HotTake {
  id: string;
  body: string;
  tmdbId: number | null;
  createdAt: string;
  user: DiscourseUser;
  counts: { like: number; agree: number; disagree: number };
  myReaction: ReactionKind | null;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  tmdbId: number | null;
  closesAt: string | null;
  createdAt: string;
  creatorId: string;
  counts: number[];
  totalVotes: number;
  myVote: number | null;
}
