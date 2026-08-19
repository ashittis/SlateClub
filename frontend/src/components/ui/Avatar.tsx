"use client";

/*
  Avatar — the single source of truth for a user's circular avatar.
  Replaces the ad-hoc "first initial" markup that was duplicated across
  TopNav, PostCard, community threads, reviews and the home twins list.

  Falls back to the initial on a warm CTA fill when no avatar_url exists.
*/

const SIZES = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
} as const;

export type AvatarSize = keyof typeof SIZES;

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

export default function Avatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
}: AvatarProps) {
  const px = SIZES[size];
  const fontSize = Math.round(px * 0.42);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${className}`}
      style={{
        width: px,
        height: px,
        fontSize,
        background: "var(--blood)",
        color: "var(--void)",
      }}
    >
      {avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        (name?.[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}
