import { get, post } from "./client";
import type { FilmCard } from "./films";

export interface Correspondent {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface ConversationSummary {
  id: string;
  lastMessageAt: string | null;
  lastPreview: string | null;
  unread: number;
  with: Correspondent;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  body: string | null;
  /** A shared film renders as a rich card in the thread. */
  sharedFilm: FilmCard | null;
  readAt: string | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  with: Correspondent;
  messages: DirectMessage[];
}

/**
 * Direct messages — one model, films included.
 *
 * A shared film is a *message* (`sharedFilm`), not a separate object, so it
 * appears in the thread in order and can be replied to. SlateClub kept those
 * apart, which meant a film recommendation was a dead end.
 */
export const messagesApi = {
  conversations: () => get<ConversationSummary[]>("/api/messages/conversations"),
  unreadCount: () => get<{ count: number }>("/api/messages/unread-count"),
  thread: (conversationId: string) =>
    get<Thread>(`/api/messages/conversations/${conversationId}`),

  /** Reply in an existing thread. */
  reply: (conversationId: string, body?: string, tmdbId?: number) =>
    post<DirectMessage & { conversationId: string }>(
      `/api/messages/conversations/${conversationId}`,
      { body, tmdbId },
    ),

  /** Send to a person, opening the thread if needed — used by "share this film". */
  sendTo: (userId: string, body?: string, tmdbId?: number) =>
    post<DirectMessage & { conversationId: string }>(`/api/messages/with/${userId}`, {
      body,
      tmdbId,
    }),
};

export const messageKeys = {
  conversations: () => ["messages", "conversations"] as const,
  thread: (id: string) => ["messages", "thread", id] as const,
  unread: () => ["messages", "unread"] as const,
};
