export type NotificationKind =
  | "twin_activity"
  | "social"
  | "release"
  | "artist"
  | "ama"
  | "slate_save"
  | "slate_message"
  | "follow"
  | "review_helpful"
  | "hidden_gem"
  | "orbit_request"
  | "orbit_accepted"
  | "cut_invite"
  | "film_recommend"
  | "dm_reaction";

export interface Notification {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
