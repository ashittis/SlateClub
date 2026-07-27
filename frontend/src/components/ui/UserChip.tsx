"use client";

import Link from "next/link";
import Avatar, { type AvatarSize } from "@/components/ui/Avatar";

/*
  UserChip — avatar + name (+ optional @handle / trailing meta) row.
  The spec's shared "Avatar + name row" used in People search results,
  Community moderators, Match Cut, and Profile follower lists.

  If a username is given the whole chip links to the profile.
*/

interface UserChipProps {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  /** Small muted text after the name, e.g. "· 2h" or a role. */
  meta?: string;
  /** Show @handle under the name (two-line layout). */
  showHandle?: boolean;
  className?: string;
}

export default function UserChip({
  name,
  username,
  avatarUrl,
  size = "sm",
  meta,
  showHandle = false,
  className = "",
}: UserChipProps) {
  const body = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Avatar name={name} avatarUrl={avatarUrl} size={size} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {name}
          {meta && (
            <span
              className="ml-1 font-normal"
              style={{ color: "var(--text-faint)" }}
            >
              {meta}
            </span>
          )}
        </span>
        {showHandle && username && (
          <span className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
            @{username}
          </span>
        )}
      </span>
    </span>
  );

  if (username) {
    return (
      <Link href={`/profile/${username}`} className="min-w-0 hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}
