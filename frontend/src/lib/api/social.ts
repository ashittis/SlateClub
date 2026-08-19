import { del, get, post } from "./client";

export interface PersonRef {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

/**
 * The follow graph — one-directional, no handshake.
 *
 * Following someone is what fills your activity feed, so this is the control
 * that closes the `follow → activity → discover` half of the loop.
 */
export const socialApi = {
  follow: (userId: string) => post<{ ok: boolean }>("/api/follows/", { user_id: userId }),
  unfollow: (userId: string) => del<{ ok: boolean }>(`/api/follows/${userId}`),
  isFollowing: (userId: string) =>
    get<{ following: boolean }>(`/api/follows/${userId}/check`),
  followers: (userId: string) => get<PersonRef[]>(`/api/follows/${userId}/followers`),
  following: (userId: string) => get<PersonRef[]>(`/api/follows/${userId}/following`),
};

export const socialKeys = {
  isFollowing: (userId: string) => ["follows", userId, "check"] as const,
  followers: (userId: string) => ["follows", userId, "followers"] as const,
  following: (userId: string) => ["follows", userId, "following"] as const,
};
