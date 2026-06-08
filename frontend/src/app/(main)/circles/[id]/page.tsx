"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";

interface Member {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  role: string;
}

interface CircleDetail {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  maxMembers: number;
  members: Member[];
}

interface Message {
  id: string;
  body: string;
  tmdbId: number | null;
  createdAt: string;
  user: { id: string; name: string; username: string; avatarUrl: string | null };
}

export default function CircleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const circle = useQuery<CircleDetail>({
    queryKey: ["circle", id],
    queryFn: () => apiFetch(`/api/circles/${id}`),
  });

  const messages = useQuery<{ messages: Message[] }>({
    queryKey: ["circle-messages", id],
    queryFn: () => apiFetch(`/api/circles/${id}/messages`),
    refetchInterval: 30_000,
  });

  const post = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/circles/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["circle-messages", id] });
    },
  });

  if (!circle.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div
          className="h-32 rounded-2xl animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
      </div>
    );
  }

  const c = circle.data;

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl font-bold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {c.name}
      </h1>
      {c.description && (
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {c.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3 mb-5 flex-wrap">
        {c.members.map((m) => (
          <span
            key={m.id}
            className="px-2 py-0.5 rounded-full text-xs"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-muted)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {m.name}
            {m.role === "admin" && " ★"}
          </span>
        ))}
      </div>

      <div
        className="rounded-2xl p-4 space-y-3 max-h-[460px] overflow-y-auto mb-3"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <AnimatePresence initial={false}>
          {messages.data?.messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                }}
              >
                {m.user.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  <span style={{ color: "var(--text-primary)" }}>
                    {m.user.name}
                  </span>{" "}
                  · {timeAgo(m.createdAt)}
                </p>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {m.body}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) post.mutate(draft.trim());
          }}
          placeholder="Send to the circle…"
          className="flex-1 rounded-full px-4 py-2 text-sm focus:outline-none"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
        <button
          onClick={() => draft.trim() && post.mutate(draft.trim())}
          disabled={!draft.trim() || post.isPending}
          className="px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
          style={{
            background: "var(--cta-gradient)",
            color: "var(--bg-screening)",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function timeAgo(s: string) {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
