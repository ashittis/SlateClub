import { del, get, patch, post } from "./client";

export interface WatchlistSummary {
  id: string;
  title: string;
  description: string | null;
  visibility: "public" | "private";
  filmCount: number;
  /** A few posters, for a collage without loading the whole list. */
  covers: (string | null)[];
  updatedAt: string;
}

export interface WatchlistFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: string | null;
  note: string | null;
  position: number;
}

export interface WatchlistDetail {
  id: string;
  title: string;
  description: string | null;
  visibility: "public" | "private";
  isOwner: boolean;
  owner: { name: string; username: string; avatarUrl: string | null };
  films: WatchlistFilm[];
}

export interface BlendMember {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface BlendSummary {
  id: string;
  title: string;
  inviteToken: string | null;
  isMember: boolean;
  members: BlendMember[];
  createdAt: string;
}

export interface BlendPick {
  tmdbId: number;
  title: string;
  year: string | null;
  posterPath: string | null;
  score: number;
  /** How many members this film surfaced for — the overlap is the blend. */
  sharedBy: number;
  evidence: { sourceName: string | null; context: string | null }[];
}

/** Why a blend has nothing to show — each needs a different message. */
export type BlendEmptyReason = "waiting_for_members" | "no_warm_pools" | "no_overlap" | null;

export interface BlendRecommendations {
  results: BlendPick[];
  reason: BlendEmptyReason;
  members: number;
}

/**
 * Named watchlists and Blends — the two things Create makes (KASET.md §8).
 *
 * A named watchlist is distinct from the single implicit watchlist behind the
 * "save for later" button: this one is curated and ordered on purpose.
 */
export const watchlistsApi = {
  mine: () => get<WatchlistSummary[]>("/api/watchlists"),
  create: (title: string, description?: string, visibility: "public" | "private" = "public") =>
    post<WatchlistSummary>("/api/watchlists", { title, description, visibility }),
  detail: (id: string) => get<WatchlistDetail>(`/api/watchlists/${id}`),
  update: (id: string, changes: { title?: string; description?: string; visibility?: string }) =>
    patch<WatchlistSummary>(`/api/watchlists/${id}`, changes),
  remove: (id: string) => del<{ ok: boolean }>(`/api/watchlists/${id}`),

  addFilm: (id: string, film: { tmdbId: number; title: string; posterPath: string | null; year?: string | null }) =>
    post<{ ok: boolean; added: boolean }>(`/api/watchlists/${id}/films`, film),
  removeFilm: (id: string, tmdbId: number) =>
    del<{ ok: boolean }>(`/api/watchlists/${id}/films/${tmdbId}`),
  /** Send the whole order — makes drag-and-drop idempotent. */
  reorder: (id: string, tmdbIds: number[]) =>
    patch<{ ok: boolean }>(`/api/watchlists/${id}/films/reorder`, { tmdbIds }),
};

export const blendsApi = {
  mine: () => get<BlendSummary[]>("/api/blends"),
  create: (title: string) => post<BlendSummary>("/api/blends", { title }),
  detail: (id: string) => get<BlendSummary>(`/api/blends/${id}`),
  join: (token: string) => post<BlendSummary>(`/api/blends/join/${token}`),
  leave: (id: string) => del<{ ok: boolean }>(`/api/blends/${id}/leave`),
  recommendations: (id: string) =>
    get<BlendRecommendations>(`/api/blends/${id}/recommendations`),
};

export const collectionKeys = {
  watchlists: () => ["watchlists"] as const,
  watchlist: (id: string) => ["watchlists", id] as const,
  blends: () => ["blends"] as const,
  blend: (id: string) => ["blends", id] as const,
  blendPicks: (id: string) => ["blends", id, "recommendations"] as const,
};
