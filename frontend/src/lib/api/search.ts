import { get } from "./client";
import type { FilmSummary, PersonSummary } from "./types";

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio?: string | null;
}

/** Search — films and people (KASET.md §8), plus finding users to follow. */
export const searchApi = {
  films: (q: string) =>
    get<{ results: FilmSummary[] }>(`/api/search/films?q=${encodeURIComponent(q)}`),

  /** Cast and crew, from TMDB. */
  people: (q: string) =>
    get<{ results: PersonSummary[] }>(`/api/search/people?q=${encodeURIComponent(q)}`),

  /** Kaset accounts — distinct from `people`, who are film-industry figures. */
  users: (q: string) =>
    get<{ items: UserSummary[] }>(`/api/users/search?q=${encodeURIComponent(q)}`),

  popularAmongFollowing: () =>
    get<{ results: FilmSummary[] }>("/api/search/popular-among-following"),
};

export const searchKeys = {
  films: (q: string) => ["search", "films", q] as const,
  people: (q: string) => ["search", "people", q] as const,
  users: (q: string) => ["search", "users", q] as const,
  popularAmongFollowing: () => ["search", "popular-among-following"] as const,
};
