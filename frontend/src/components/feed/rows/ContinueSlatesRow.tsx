"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import FeedRow from "@/components/ui/FeedRow";
import SlateProgressCard from "@/components/slates/SlateProgressCard";
import type { SlateCard } from "@/types/slates";

/*
  "Continue your Slates" — the user's own Slates as compact progress cards.
  Sourced from /api/slates/mine. Hidden when the user has no Slates yet.
*/

export default function ContinueSlatesRow() {
  const { user } = useAuthStore();
  const { data } = useQuery<{ items: SlateCard[] }>({
    queryKey: ["slates", "mine"],
    queryFn: () => apiFetch("/api/slates/mine"),
    enabled: !!user,
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <FeedRow title="Continue your Slates" seeAllHref="/slates">
      {items.slice(0, 12).map((s) => (
        <SlateProgressCard key={s.id} slate={s} />
      ))}
    </FeedRow>
  );
}
