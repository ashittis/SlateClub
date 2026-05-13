"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import NotificationItem from "@/components/notifications/NotificationItem";
import type { Notification } from "@/types/notifications";

const KIND_GROUPS: Array<{
  label: string;
  kinds: Notification["kind"][];
}> = [
  { label: "Twins", kinds: ["twin_activity", "hidden_gem"] },
  { label: "Social", kinds: ["follow", "review_helpful", "slate_save", "slate_message"] },
  { label: "Releases", kinds: ["release"] },
  { label: "Artists", kinds: ["artist", "ama"] },
];

export default function NotificationsPage() {
  const qc = useQueryClient();

  const list = useQuery<{ items: Notification[] }>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications"),
    refetchInterval: 30_000,
  });

  const readAll = useMutation({
    mutationFn: () => apiFetch("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const items = list.data?.items ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl px-4 lg:px-6 pt-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1
          className="display text-2xl lg:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Notifications
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={() => readAll.mutate()}
            className="text-xs font-medium"
            style={{ color: "var(--cta-primary)" }}
          >
            Mark all read
          </button>
        )}
      </div>

      {list.isLoading && (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Loading…
        </p>
      )}
      {!list.isLoading && items.length === 0 && (
        <p
          className="text-sm rounded-xl p-6 text-center"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          You&apos;re all caught up.
        </p>
      )}

      <div className="space-y-6">
        {KIND_GROUPS.map((group) => {
          const groupItems = items.filter((n) => group.kinds.includes(n.kind));
          if (groupItems.length === 0) return null;
          return (
            <section key={group.label}>
              <h2
                className="text-xs uppercase tracking-wider mb-2"
                style={{ color: "var(--text-faint)" }}
              >
                {group.label}
              </h2>
              <div className="space-y-2">
                {groupItems.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    onRead={() => !n.readAt && markRead.mutate(n.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
