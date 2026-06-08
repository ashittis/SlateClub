"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";

export interface UserLite {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

interface Props {
  meId: string | null;
  value: UserLite[];
  onChange: (next: UserLite[]) => void;
}

/*
  FriendMultiPicker — pick the people you want to watch with.
  Seeds from who you follow; live-searches everyone else. Selected
  people show as removable chips (≥44px tap targets).
*/
export default function FriendMultiPicker({ meId, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().replace(/^@/, "")), 250);
    return () => clearTimeout(t);
  }, [query]);

  const following = useQuery<UserLite[]>({
    queryKey: ["mc-following", meId],
    queryFn: async () => {
      const rows = await apiFetch<
        { id: string; name: string; username: string; avatar_url: string | null }[]
      >(`/api/follows/${meId}/following`);
      return rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatar_url,
      }));
    },
    enabled: !!meId,
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

  const selectedIds = new Set(value.map((u) => u.id));
  const add = (u: UserLite) => {
    if (u.id === meId || selectedIds.has(u.id)) return;
    onChange([...value, u]);
    setQuery("");
  };
  const remove = (id: string) => onChange(value.filter((u) => u.id !== id));

  const source = debounced.length >= 1 ? search.data ?? [] : following.data ?? [];
  const suggestions = source.filter((u) => u.id !== meId && !selectedIds.has(u.id));

  return (
    <div className="space-y-4">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {value.map((u) => (
              <motion.button
                key={u.id}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => remove(u.id)}
                className="flex min-h-[44px] items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3"
                style={{
                  background: "rgba(255, 138, 0, 0.15)",
                  border: "1px solid rgba(255, 138, 0, 0.45)",
                }}
                aria-label={`Remove ${u.name}`}
              >
                <Avatar user={u} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {u.name.split(" ")[0]}
                </span>
                <span style={{ color: "var(--text-faint)" }}>✕</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people to add…"
        className="w-full rounded-full px-4 py-3 text-sm focus:outline-none"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--text-primary)",
        }}
      />

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1">
          {debounced.length < 1 && (
            <p className="px-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              People you follow
            </p>
          )}
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => add(u)}
              className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:opacity-90"
              style={{ background: "var(--bg-card)" }}
            >
              <Avatar user={u} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {u.name}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                  @{u.username}
                </p>
              </div>
              <span className="text-lg" style={{ color: "var(--cta-primary)" }}>
                +
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ user }: { user: UserLite }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}
    >
      {user.avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={user.avatarUrl} alt={user.name} className="h-full w-full rounded-full object-cover" />
      ) : (
        user.name[0]?.toUpperCase()
      )}
    </span>
  );
}
