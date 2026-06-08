"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  tmdbId: number;
  title: string;
}

interface Orbit {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

/* Instagram-style share sheet — send a film to people in your orbit (their DMs). */
export default function RecommendSheet({ open, onClose, tmdbId, title }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const qc = useQueryClient();

  const orbits = useQuery<{ items: Orbit[] }>({
    queryKey: ["orbits"],
    queryFn: () => apiFetch("/api/orbits"),
    enabled: open,
  });

  const send = useMutation({
    mutationFn: () =>
      apiFetch("/api/dms", {
        method: "POST",
        body: JSON.stringify({ recipientIds: [...selected], tmdbId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dms"] });
      qc.invalidateQueries({ queryKey: ["dms-unread"] });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSelected(new Set());
        onClose();
      }, 900);
    },
  });

  if (!open) return null;
  const items = orbits.data?.items ?? [];
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="display text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Recommend “{title}”
        </h3>
        <p className="mb-4 mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          Send to people in your orbit
        </p>

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            No orbits yet — add friends to recommend films to them.
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {items.map((u) => {
              const on = selected.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
                  style={{ background: on ? "rgba(255,138,0,0.12)" : "transparent" }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}
                  >
                    {u.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={u.avatarUrl} alt={u.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      u.name[0]?.toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {u.name}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                      @{u.username}
                    </p>
                  </div>
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
                    style={{
                      background: on ? "var(--cta-gradient)" : "transparent",
                      border: on ? "none" : "1.5px solid rgba(255,255,255,0.2)",
                      color: "#fff",
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => send.mutate()}
          disabled={selected.size === 0 || send.isPending}
          className="mt-4 w-full rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" }}
        >
          {sent ? "Sent ✓" : send.isPending ? "Sending…" : `Send${selected.size ? ` to ${selected.size}` : ""}`}
        </button>
      </div>
    </div>
  );
}
