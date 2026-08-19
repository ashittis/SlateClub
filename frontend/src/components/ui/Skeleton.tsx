"use client";

interface SkeletonProps {
  className?: string;
}

/**
 * A loading placeholder.
 *
 * Square and token-coloured: it previously used `bg-glass-8`, a SlateClub
 * theme class that no longer exists, so it rendered as an invisible box — a
 * loading state you could not see is not a loading state.
 */
export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse ${className}`}
      style={{ background: "var(--soot)" }}
    />
  );
}
