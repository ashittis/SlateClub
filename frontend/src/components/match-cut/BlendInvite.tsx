"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import type { UserLite } from "./FriendMultiPicker";

interface Props {
  me: { id: string; name: string; avatarUrl: string | null } | null;
  onInvite: (friend: UserLite) => void;
  onCancel: () => void;
  pending?: boolean;
}

/*
  BlendInvite — Spotify-Blend style entry point. Pick ONE friend to blend
  tastes with; no naming step. Two circles (you + a "+" that becomes the
  friend once chosen), then Invite. Person-to-person only.
*/
export default function BlendInvite({ me, onInvite, onCancel, pending }: Props) {
  const [picking, setPicking] = useState(false);
  const [friend, setFriend] = useState<UserLite | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().replace(/^@/, "")), 250);
    return () => clearTimeout(t);
  }, [query]);

  const following = useQuery<UserLite[]>({
    queryKey: ["mc-following", me?.id],
    queryFn: async () => {
      const rows = await apiFetch<
        { id: string; name: string; username: string; avatar_url: string | null }[]
      >(`/api/follows/${me?.id}/following`);
      return rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatar_url,
      }));
    },
    enabled: !!me?.id,
    staleTime: 60_000,
  });

  const search = useQuery<UserLite[]>({
    queryKey: ["mc-user-search", debounced],
    queryFn: async () => {
      const res = await apiFetch<{ items: UserLite[] }>(
        `/api/users/search?q=${encodeURIComponent(debounced)}&limit=8`,
      );
      return res.items ?? [];
    },
    enabled: debounced.length >= 1,
    staleTime: 30_000,
  });

  const suggestions = useMemo(() => {
    const source = debounced.length >= 1 ? search.data ?? [] : following.data ?? [];
    return source.filter((u) => u.id !== me?.id);
  }, [debounced, search.data, following.data, me?.id]);

  return (
    <div
      className="rounded-3xl px-6 py-12 text-center"
      style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Two circles: you + friend/placeholder */}
      <div className="flex items-center justify-center gap-3">
        <Circle avatarUrl={me?.avatarUrl ?? null} label={me?.name ?? "You"} />
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-label={friend ? "Change friend" : "Pick a friend"}
          className="transition hover:opacity-90"
        >
          {friend ? (
            <Circle avatarUrl={friend.avatarUrl} label={friend.name} />
          ) : (
            <span
              className="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-light"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              +
            </span>
          )}
        </button>
      </div>

      <h2 className="display mt-6 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        {friend ? `Blend with ${friend.name.split(" ")[0]}` : "Invite a friend"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--text-muted)" }}>
        Pick a friend to create a Match Cut with — a shared list that shows how
        your film taste lines up.
      </p>

      {/* Friend picker */}
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-auto mt-5 max-w-sm overflow-hidden text-left"
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="w-full rounded-full px-4 py-3 text-sm focus:outline-none"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--text-primary)",
              }}
            />
            {suggestions.length > 0 && (
              <div className="mt-2 space-y-1">
                {debounced.length < 1 && (
                  <p className="px-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    People you follow
                  </p>
                )}
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setFriend(u);
                      setPicking(false);
                      setQuery("");
                    }}
                    className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:opacity-90"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <Circle avatarUrl={u.avatarUrl} label={u.name} small />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {u.name}
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                        @{u.username}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="mt-7 flex items-center justify-center gap-2">
        <button
          onClick={() => friend && onInvite(friend)}
          disabled={!friend || pending}
          className="rounded-full px-8 py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" }}
        >
          {pending ? "Creating…" : "Invite"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-full px-5 py-3 text-sm font-medium"
          style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
        >
          Cancel
        </button>
      </div>

      <p className="mx-auto mt-6 max-w-md text-xs" style={{ color: "var(--text-faint)" }}>
        The friend you invite will see your profile picture and username. Inviting
        creates a shared Match Cut with recommendations that match both your tastes.
      </p>
    </div>
  );
}

function Circle({
  avatarUrl,
  label,
  small,
}: {
  avatarUrl: string | null;
  label: string;
  small?: boolean;
}) {
  const size = small ? "h-9 w-9 text-xs" : "h-24 w-24 text-3xl";
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full font-bold`}
      style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}
    >
      {avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={avatarUrl} alt={label} className="h-full w-full rounded-full object-cover" />
      ) : (
        label[0]?.toUpperCase()
      )}
    </span>
  );
}
