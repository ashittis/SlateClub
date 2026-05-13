"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import ActivityFeed from "@/components/social/ActivityFeed";
import type { ActivityEvent } from "@/types/social";

export default function ActivityPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["activity", "feed"],
    queryFn: () => apiFetch<{ events: ActivityEvent[] }>("/api/activity/feed"),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <h1 className="mb-6 text-2xl font-bold text-text-primary">Activity</h1>

      {!user && (
        <p className="py-12 text-center text-sm text-text-subtle">
          Log in to see activity from people you follow.
        </p>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-glass-8" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-glass-8" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-glass-8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && <ActivityFeed events={data.events} />}
    </div>
  );
}
