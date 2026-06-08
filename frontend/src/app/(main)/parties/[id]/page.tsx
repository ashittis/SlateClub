"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

interface PartyState {
  playbackSeconds: number;
  playbackUpdatedAt: string;
  status: string;
  participantCount: number;
}

interface Party {
  id: string;
  tmdbId: number;
  title: string;
  hostId: string;
  startsAt: string;
  status: string;
  playbackSeconds: number;
}

interface Reaction {
  id: string;
  body: string;
  playbackSeconds: number;
  createdAt: string;
  user: { id: string; name: string; username: string; avatarUrl: string | null };
}

export default function WatchPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [draft, setDraft] = useState("");

  const party = useQuery<Party>({
    queryKey: ["party", id],
    queryFn: () => apiFetch(`/api/parties/${id}`),
  });

  const state = useQuery<PartyState>({
    queryKey: ["party-state", id],
    queryFn: () => apiFetch(`/api/parties/${id}/state`),
    refetchInterval: 5_000,
  });

  const reactions = useQuery<{ items: Reaction[] }>({
    queryKey: ["party-reactions", id],
    queryFn: () => apiFetch(`/api/parties/${id}/reactions`),
    refetchInterval: 3_000,
  });

  const join = useMutation({
    mutationFn: () => apiFetch(`/api/parties/${id}/join`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["party-state", id] }),
  });

  const post = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/parties/${id}/reactions`, {
        method: "POST",
        body: JSON.stringify({
          body,
          playbackSeconds: state.data?.playbackSeconds ?? 0,
        }),
      }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["party-reactions", id] });
    },
  });

  const playbackPush = useMutation({
    mutationFn: (sec: number) =>
      apiFetch(`/api/parties/${id}/playback`, {
        method: "POST",
        body: JSON.stringify({ playback_seconds: sec, status: "live" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["party-state", id] }),
  });

  if (!party.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div
          className="h-32 rounded-2xl animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
      </div>
    );
  }

  const p = party.data;
  const isHost = user?.id === p.hostId;
  const seconds = state.data?.playbackSeconds ?? p.playbackSeconds ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {p.title}
      </h1>
      <p className="text-xs mb-5" style={{ color: "var(--text-faint)" }}>
        Watch party · {state.data?.participantCount ?? 1} watching ·{" "}
        {state.data?.status ?? p.status}
      </p>

      <div
        className="rounded-2xl p-5 mb-5 flex items-center gap-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex-1">
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Playback
          </p>
          <p
            className="display text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {fmtTime(seconds)}
          </p>
        </div>
        {isHost ? (
          <div className="flex gap-2">
            <button
              onClick={() => playbackPush.mutate(Math.max(0, seconds - 15))}
              className="px-3 py-1.5 rounded-md text-xs font-semibold"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              −15s
            </button>
            <button
              onClick={() => playbackPush.mutate(seconds + 15)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold"
              style={{
                background: "var(--cta-gradient)",
                color: "var(--bg-screening)",
              }}
            >
              +15s
            </button>
          </div>
        ) : (
          <button
            onClick={() => join.mutate()}
            className="px-3 py-1.5 rounded-md text-xs font-semibold"
            style={{
              background: "var(--cta-gradient)",
              color: "var(--bg-screening)",
            }}
          >
            Join
          </button>
        )}
      </div>

      <div
        className="rounded-2xl p-3 mb-5"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) post.mutate(draft.trim());
          }}
          placeholder="React in the moment…"
          className="w-full bg-transparent focus:outline-none text-sm"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {reactions.data?.items.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2"
            >
              <span
                className="text-[10px] tabular-nums shrink-0 w-12 text-right pt-0.5"
                style={{ color: "var(--text-faint)" }}
              >
                {fmtTime(r.playbackSeconds)}
              </span>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                <span style={{ color: "var(--text-muted)" }}>
                  {r.user.name}:
                </span>{" "}
                {r.body}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function fmtTime(s: number) {
  const total = Math.floor(s);
  const m = Math.floor(total / 60);
  const sec = (total % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
