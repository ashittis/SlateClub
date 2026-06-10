"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

/* ── Types ─────────────────────────────────────────────────── */

interface ChatConv {
  id: string;
  other: { id: string; name: string; username: string; avatarUrl: string | null };
  lastPreview: string | null;
  lastMessageAt: string | null;
}

interface FilmDM {
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

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) { const w = Math.floor(days / 7); return `${w}w ago`; }
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Chat conversations list ───────────────────────────────── */

function ChatTab() {
  const convs = useQuery<{ items: ChatConv[] }>({
    queryKey: ["chat", "conversations"],
    queryFn: () => apiFetch("/api/chat/conversations"),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const items = convs.data?.items ?? [];

  if (convs.isLoading) {
    return (
      <div className="space-y-3 mt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "var(--bg-card)" }}>
            <div className="w-10 h-10 animate-pulse rounded-full" style={{ background: "var(--bg-elevated)" }} />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
              <div className="h-3 w-48 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p
        className="mt-4 rounded-xl p-6 text-center text-sm"
        style={{ color: "var(--text-faint)", background: "var(--bg-card)", border: "1px dashed rgba(255,255,255,0.06)" }}
      >
        No messages yet. Find someone from their profile to start a conversation.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {items.map((conv) => (
        <Link
          key={conv.id}
          href={`/messages/${conv.id}`}
          className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-glass-6"
          style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold overflow-hidden"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
          >
            {conv.other.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={conv.other.avatarUrl} alt={conv.other.name} className="w-full h-full object-cover" />
            ) : (
              conv.other.name[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {conv.other.name}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
              {conv.lastPreview ?? "Start a conversation…"}
            </p>
          </div>
          {conv.lastMessageAt && (
            <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
              {timeAgo(conv.lastMessageAt)}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/* ── Film recs tab ─────────────────────────────────────────── */

function FilmRecsTab() {
  const qc = useQueryClient();
  const inbox = useQuery<{ items: FilmDM[] }>({
    queryKey: ["dms"],
    queryFn: () => apiFetch("/api/dms"),
    staleTime: 0,
    refetchInterval: 15_000,
  });
  const items = inbox.data?.items ?? [];

  useEffect(() => {
    const unread = (inbox.data?.items ?? []).filter((i) => !i.read);
    if (unread.length === 0) return;
    Promise.all(unread.map((i) => apiFetch(`/api/dms/${i.id}/read`, { method: "POST" }))).then(() =>
      qc.invalidateQueries({ queryKey: ["dms-unread"] })
    );
  }, [inbox.data, qc]);

  const react = useMutation({
    mutationFn: ({ id, reaction }: { id: string; reaction: string }) =>
      apiFetch(`/api/dms/${id}/reaction`, { method: "POST", body: JSON.stringify({ reaction }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dms"] }); qc.invalidateQueries({ queryKey: ["dms-unread"] }); },
  });

  const addWatch = useMutation({
    mutationFn: (tmdbId: number) => apiFetch(`/api/movies/${tmdbId}/watchlist`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dms"] }),
  });

  if (inbox.isLoading) return <p className="text-sm mt-4" style={{ color: "var(--text-faint)" }}>Loading…</p>;

  if (items.length === 0) {
    return (
      <p
        className="mt-4 rounded-xl p-6 text-center text-sm"
        style={{ color: "var(--text-faint)", background: "var(--bg-card)", border: "1px dashed rgba(255,255,255,0.06)" }}
      >
        No film recs yet. When someone sends you a film, it lands here.
      </p>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      {items.map((dm) => (
        <div
          key={dm.id}
          className="flex gap-3 rounded-2xl p-3"
          style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Link href={`/film/${dm.tmdbId}`} className="shrink-0">
            <div className="w-16 overflow-hidden rounded-lg" style={{ aspectRatio: "2/3", background: "var(--bg-elevated)" }}>
              {dm.posterPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tmdbImage(dm.posterPath, "w200")} alt={dm.title} className="h-full w-full object-cover" />
              )}
            </div>
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/film/${dm.tmdbId}`}>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{dm.title}</p>
            </Link>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              <Link href={`/profile/${dm.from.username}`} style={{ color: "var(--cta-primary)" }}>@{dm.from.username}</Link>{" "}recommended this
            </p>
            <button
              onClick={() => !dm.watchlisted && addWatch.mutate(dm.tmdbId)}
              disabled={dm.watchlisted || addWatch.isPending}
              className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={dm.watchlisted
                ? { background: "var(--bg-elevated)", color: "var(--cta-primary)", border: "1px solid rgba(255,138,0,0.4)" }
                : { background: "var(--cta-gradient)", color: "#fff" }}
            >
              {dm.watchlisted ? "✓ Shelved" : "+ Shelf"}
            </button>
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
  );
}

/* ── Page ──────────────────────────────────────────────────── */

type ActiveTab = "chat" | "film-recs";

export default function MessagesPage() {
  const [tab, setTab] = useState<ActiveTab>("chat");
  const { user } = useAuthStore();

  return (
    <div className="mx-auto max-w-2xl px-4 lg:px-6 pt-6 pb-24">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="display text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Messages
        </h1>
        {user && (
          <Link
            href="/community"
            className="text-xs font-medium rounded-full px-3 py-1.5 transition"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", background: "var(--bg-elevated)" }}
          >
            Find people
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        {(["chat", "film-recs"] as ActiveTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ color: tab === t ? "var(--cta-primary)" : "var(--text-faint)" }}
          >
            {t === "chat" ? "Chat" : "Film Recs"}
            {tab === t && (
              <motion.div
                layoutId="msgTab"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: "var(--cta-primary)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {tab === "chat" ? <ChatTab /> : <FilmRecsTab />}
    </div>
  );
}
