import { get } from "./client";

export interface ActivityEvent {
  id: string;
  userId: string;
  type: "rated" | "logged" | "watchlisted" | "reviewed";
  movieId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; username: string; avatar_url: string | null };
  movie: { id: string; title: string; tmdbId: number; posterPath: string | null };
}

/**
 * Activity — what the people you follow have been watching.
 *
 * Derived live from the source tables rather than a stored event log, so it can
 * never disagree with the diary. Private viewings are filtered server-side.
 */
export const activityApi = {
  feed: (scope: "network" | "world" = "network", limit = 30) =>
    get<{ events: ActivityEvent[]; total: number; scope: string }>(
      `/api/activity/feed?scope=${scope}&limit=${limit}`,
    ),
};

export const activityKeys = {
  feed: (scope: string) => ["activity", scope] as const,
};

/** "rated ★4", "logged", "added to watchlist", "reviewed" */
export function describeActivity(e: ActivityEvent): string {
  switch (e.type) {
    case "rated": {
      const r = e.metadata?.rating;
      return typeof r === "number" ? `rated ${r}` : "rated";
    }
    case "logged":
      return e.metadata?.rewatch ? "rewatched" : "logged";
    case "watchlisted":
      return "added to watchlist";
    case "reviewed":
      return "reviewed";
  }
}
