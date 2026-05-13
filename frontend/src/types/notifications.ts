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
  | "hidden_gem";

export interface Notification {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
