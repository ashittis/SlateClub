"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";

interface DMItem {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  from: { id: string; name: string; username: string; avatarUrl: string | null };
  reaction: string | null;
  read: boolean;
  watchlisted: boolean;
  createdAt: string;
}

const REACTIONS: { key: string; label: string }[] = [
  { key: "peak", label: "Peak" },
  { key: "mid", label: "Mid" },
  { key: "never_again", label: "Never watching again" },
  { key: "worst_ever", label: "Worst ever" },
  { key: "absolute_worst", label: "Absolute worst" },
];

export default function MessagesPage() {
  const qc = useQueryClient();
  const inbox = useQuery<{ items: DMItem[] }>({
    queryKey: ["dms"],
    queryFn: () => apiFetch("/api/dms"),
    staleTime: 0,
    refetchInterval: 15_000,
  });
  const items = inbox.data?.items ?? [];

  // Clear the unread badge when the inbox is opened.
  useEffect(() => {
    const unread = (inbox.data?.items ?? []).filter((i) => !i.read);
    if (unread.length === 0) return;
    Promise.all(
      unread.map((i) => apiFetch(`/api/dms/${i.id}/read`, { method: "POST" })),
    ).then(() => qc.invalidateQueries({ queryKey: ["dms-unread"] }));
  }, [inbox.data, qc]);

  const react = useMutation({
    mutationFn: ({ id, reaction }: { id: string; reaction: string }) =>
      apiFetch(`/api/dms/${id}/reaction`, { method: "POST", body: JSON.stringify({ reaction }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dms"] });
      qc.invalidateQueries({ queryKey: ["dms-unread"] });
    },
  });

  const addWatch = useMutation({
    mutationFn: (tmdbId: number) => apiFetch(`/api/movies/${tmdbId}/watchlist`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dms"] }),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 lg:px-6 pt-6 pb-24">
      <h1 className="display mb-5 text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        Messages
      </h1>

      {inbox.isLoading ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p
          className="rounded-xl p-6 text-center text-sm"
          style={{ color: "var(--text-faint)", background: "var(--bg-card)", border: "1px dashed rgba(255,255,255,0.06)" }}
        >
          No recommendations yet. When someone sends you a film, it lands here.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((dm) => (
            <div
              key={dm.id}
              className="flex gap-3 rounded-2xl p-3"
              style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Link href={`/film/${dm.tmdbId}`} className="shrink-0">
                <div className="w-16 overflow-hidden rounded-lg" style={{ aspectRatio: "2/3", background: "var(--bg-elevated)" }}>
                  {dm.posterPath && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={tmdbImage(dm.posterPath, "w200")} alt={dm.title} className="h-full w-full object-cover" />
                  )}
                </div>
              </Link>

              <div className="min-w-0 flex-1">
                <Link href={`/film/${dm.tmdbId}`}>
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {dm.title}
                  </p>
                </Link>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  <Link href={`/profile/${dm.from.username}`} style={{ color: "var(--cta-primary)" }}>
                    @{dm.from.username}
                  </Link>{" "}
                  recommended this
                </p>

                {/* Watchlist */}
                <button
                  onClick={() => !dm.watchlisted && addWatch.mutate(dm.tmdbId)}
                  disabled={dm.watchlisted || addWatch.isPending}
                  className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={
                    dm.watchlisted
                      ? { background: "var(--bg-elevated)", color: "var(--cta-primary)", border: "1px solid rgba(255,138,0,0.4)" }
                      : { background: "var(--cta-gradient)", color: "#fff" }
                  }
                >
                  {dm.watchlisted ? "✓ Shelved" : "+ Shelf"}
                </button>

                {/* Template reactions — no free text */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dm.reaction ? (
                    <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,138,0,0.15)", color: "var(--cta-primary)", border: "1px solid rgba(255,138,0,0.4)" }}>
                      You said: {REACTIONS.find((r) => r.key === dm.reaction)?.label ?? dm.reaction}
                    </span>
                  ) : (
                    REACTIONS.map((r) => (
                      <button
                        key={r.key}
                        onClick={() => react.mutate({ id: dm.id, reaction: r.key })}
                        disabled={react.isPending}
                        className="rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-60"
                        style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        {r.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
