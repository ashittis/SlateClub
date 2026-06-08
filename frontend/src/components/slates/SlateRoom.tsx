"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import type { SlateRoomMessage } from "@/types/slates";

interface Props {
  slateId: string;
}

interface RoomResp {
  messages: SlateRoomMessage[];
}

export default function SlateRoom({ slateId }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data, isLoading } = useQuery<RoomResp>({
    queryKey: ["slate-room", slateId],
    queryFn: () => apiFetch(`/api/slates/${slateId}/room`),
    refetchInterval: 30_000,
  });

  const post = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/slates/${slateId}/room`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["slate-room", slateId] });
    },
  });

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    post.mutate(text);
  };

  return (
    <section
      className="rounded-2xl flex flex-col h-full max-h-[640px]"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <header
        className="px-5 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <h3
          className="display text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Slate Room
        </h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
          Discuss this collection. Updates every 30s.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {isLoading && (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Loading…
          </p>
        )}
        {data && data.messages.length === 0 && (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            No messages yet. Start the conversation.
          </p>
        )}
        <AnimatePresence initial={false}>
          {data?.messages.map((m) => (
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
                <p
                  className="text-xs"
                  style={{ color: "var(--text-faint)" }}
                >
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

      <footer
        className="p-3 border-t flex gap-2"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Share a thought…"
          className="flex-1 rounded-full px-4 py-2 text-sm focus:outline-none"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
        <button
          onClick={send}
          disabled={post.isPending || !draft.trim()}
          className="px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
          style={{
            background: "var(--cta-gradient)",
            color: "var(--bg-screening)",
          }}
        >
          Send
        </button>
      </footer>
    </section>
  );
}

function timeAgo(s: string) {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
