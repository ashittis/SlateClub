"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { socialApi, socialKeys } from "@/lib/api/social";
import { passportKeys } from "@/lib/api/passport";

/**
 * Follow / unfollow.
 *
 * The control that makes the activity feed mean anything — without it the
 * backend's follow graph has no way in. One-directional: following someone
 * needs no approval from them, so this is a single toggle rather than a
 * request-and-accept dance.
 */
export default function FollowButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: socialKeys.isFollowing(userId),
    queryFn: () => socialApi.isFollowing(userId),
  });

  const following = data?.following ?? false;

  const toggle = async () => {
    if (following) await socialApi.unfollow(userId);
    else await socialApi.follow(userId);
    queryClient.invalidateQueries({ queryKey: socialKeys.isFollowing(userId) });
    // The passport shows follower counts, so it goes stale too.
    queryClient.invalidateQueries({ queryKey: passportKeys.user(username) });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isLoading}
      aria-pressed={following}
      className="min-h-[44px] border px-4 text-sm font-semibold disabled:opacity-50"
      style={{
        borderColor: following ? "var(--edge)" : "var(--blood)",
        background: following ? "var(--soot)" : "var(--blood)",
        color: following ? "var(--chalk)" : "var(--soot)",
      }}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
