"use client";

import { useState } from "react";
import type { User } from "@/types/user";
import type { PublicProfile } from "@/types/user";
import Button from "@/components/ui/Button";
import EditProfileModal from "./EditProfileModal";

interface Props {
  user: User;
  profile: PublicProfile | null;
  filmsThisYear: number;
  onSignOut: () => void;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold leading-none sm:text-xl" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>{label}</p>
    </div>
  );
}

export default function ProfileHero({ user, profile, filmsThisYear, onSignOut }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="mb-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        {/* Identity */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-glass-8 text-2xl font-bold text-glass-55 ring-2 ring-white/5">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              user.name[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{user.name}</h1>
            <p className="text-sm" style={{ color: "var(--text-subtle)" }}>@{user.username}</p>
            <div className="mt-2 flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit profile</Button>
              <Button variant="ghost" size="sm" onClick={onSignOut}>Sign out</Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-5 sm:gap-6">
          <Stat value={profile?.watched_count ?? 0} label="Films" />
          <Stat value={filmsThisYear} label="This Year" />
          <Stat value={profile?.following_count ?? 0} label="Following" />
          <Stat value={profile?.followers_count ?? 0} label="Followers" />
        </div>
      </div>

      {user.bio && (
        <p className="mt-4 max-w-xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{user.bio}</p>
      )}

      <EditProfileModal isOpen={editing} onClose={() => setEditing(false)} />
    </div>
  );
}
