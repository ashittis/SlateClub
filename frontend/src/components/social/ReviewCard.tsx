"use client";

import type { Review } from "../../types/social";

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
    <div className="rounded-lg bg-glass-6 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-green/80 text-xs font-bold text-text-primary">
          {review.user.avatar_url ? (
            <img src={review.user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            review.user.name[0]?.toUpperCase()
          )}
        </div>
        <span className="text-sm font-medium text-text-primary">@{review.user.username}</span>
        <span className="text-xs text-text-subtle">{timeAgo(review.createdAt)}</span>
        {review.spoiler && (
          <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-medium text-accent-red">
            SPOILER
          </span>
        )}
      </div>

      <p
        className={`text-sm leading-relaxed text-glass-55 ${
          review.spoiler ? "cursor-pointer blur-sm transition-all hover:blur-none" : ""
        }`}
      >
        {review.body}
      </p>

      <div className="mt-2 flex items-center gap-4 text-xs text-text-subtle">
        <button onClick={onHelpful} className="transition-colors hover:text-accent-green/80">
          Helpful ({review.helpfulCount})
        </button>
        {review._count && <span>{review._count.comments} comments</span>}
      </div>
    </div>
  );
}
