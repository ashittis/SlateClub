"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import UserChip from "@/components/ui/UserChip";

/*
  PeopleResults — the People tab of Search. Backed by /api/users/search.
  Reuses the shared UserChip (avatar + name row) for each hit.
*/

interface UserHit {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
}

interface Props {
  query: string;
  /** Cap the number shown (used by the blended "All" tab). */
  limit?: number;
}

export default function PeopleResults({ query, limit }: Props) {
  const { data, isLoading } = useQuery<{ items: UserHit[] }>({
    queryKey: ["search-people", query],
    queryFn: () => apiFetch(`/api/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  const items = (data?.items ?? []).slice(0, limit ?? 50);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-1/2 animate-pulse rounded" style={{ background: "var(--bg-card)" }} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
        No people match “{query}”.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((u) => (
        <div key={u.id} className="flex items-center gap-3">
          <UserChip name={u.name} username={u.username} avatarUrl={u.avatarUrl} size="md" showHandle />
        </div>
      ))}
    </div>
  );
}
