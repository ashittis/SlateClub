"use client";

import Avatar from "@/components/ui/Avatar";
import type { Review } from "../../types/social";

/*
  Rebuilt on Kaset's tokens. This component still carried SlateClub's Tailwind
  theme — `bg-glass-6`, `text-text-primary`, `accent-green` — none of which
  survived the rebase, so every one of those classes resolved to nothing and the
  card rendered as unstyled text on the page background.
*/

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface Props {
  review: Review;
  onHelpful?: () => void;
}

export default function ReviewCard({ review, onHelpful }: Props) {
  return (
    <div className="border p-3" style={{ borderColor: "var(--edge)", background: "var(--soot)" }}>
      <div className="mb-2 flex items-center gap-2">
        <Avatar
          avatarUrl={review.user.avatar_url}
          name={review.user.name}
          size="xs"
        />
        <span className="text-sm font-medium">@{review.user.username}</span>
        <span className="meta">{timeAgo(review.createdAt)}</span>
        {review.spoiler && (
          <span
            className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "var(--blood)", color: "var(--chalk)" }}
          >
            Spoiler
          </span>
        )}
      </div>

      <p
        className={`text-sm leading-relaxed ${
          review.spoiler ? "cursor-pointer blur-sm transition-all hover:blur-none" : ""
        }`}
        style={{ color: "var(--chalk)" }}
      >
        {review.body}
      </p>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={onHelpful}
          className="meta transition-colors hover:text-[var(--acid)]"
        >
          Helpful ({review.helpfulCount})
        </button>
        {review._count && <span className="meta">{review._count.comments} comments</span>}
      </div>
    </div>
  );
}
