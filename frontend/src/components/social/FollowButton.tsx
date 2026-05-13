"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocialStore } from "../../stores/socialStore";
import { apiFetch } from "../../lib/api";

interface Props {
  userId: string;
  initialFollowing?: boolean;
}

export default function FollowButton({ userId, initialFollowing }: Props) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const { followUser, unfollowUser } = useSocialStore();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["follow-check", userId],
    queryFn: () => apiFetch<{ isFollowing: boolean }>(`/api/follows/${userId}/check`),
    initialData: initialFollowing != null ? { isFollowing: initialFollowing } : undefined,
  });

  const isFollowing = optimistic ?? data?.isFollowing ?? false;

  const handleToggle = async () => {
    const newState = !isFollowing;
    setOptimistic(newState);
    try {
      if (newState) {
        await followUser(userId);
      } else {
        await unfollowUser(userId);
      }
      queryClient.invalidateQueries({ queryKey: ["follow-check", userId] });
    } catch {
      setOptimistic(null);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
        isFollowing
          ? "bg-accent-green text-bg-primary hover:bg-accent-green/90"
          : "border border-glass-15 text-glass-55 hover:border-glass-40"
      }`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
