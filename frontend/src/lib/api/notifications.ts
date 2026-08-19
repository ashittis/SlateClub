import { get, post } from "./client";
import type { UnreadCount } from "./types";

export interface Notification {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: () => get<Notification[]>("/api/notifications"),
  unreadCount: () => get<UnreadCount>("/api/notifications/unread-count"),
  markRead: (id: string) => post<{ ok: boolean }>(`/api/notifications/${id}/read`),
  markAllRead: () => post<{ ok: boolean }>("/api/notifications/read-all"),
};

export const notificationKeys = {
  list: () => ["notifications", "list"] as const,
  unread: () => ["notifications", "unread"] as const,
};
