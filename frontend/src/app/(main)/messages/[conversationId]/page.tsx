"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────────────── */

interface MsgUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

interface Message {
  id: string;
  body: string;
  sender: MsgUser;
  mine: boolean;
  createdAt: string;
}

interface ThreadData {
  messages: Message[];
  other: MsgUser | null;
  conversationId: string;
}

/* ── Thread page ────────────────────────────────────────────── */

export default function ThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const thread = useQuery<ThreadData>({
    queryKey: ["chat", "thread", conversationId],
    queryFn: () => apiFetch(`/api/chat/conversations/${conversationId}/messages`),
    refetchInterval: 8_000,
    staleTime: 4_000,
    enabled: !!conversationId,
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      apiFetch<Message>(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: (newMsg: Message) => {
      qc.setQueryData<ThreadData>(["chat", "thread", conversationId], (old) => {
        if (!old) return old;
        return { ...old, messages: [...old.messages, newMsg] };
      });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
      setDraft("");
    },
  });

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data?.messages.length]);

  function handleSend() {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const other = thread.data?.other;
  const messages = thread.data?.messages ?? [];

  return (
    <div className="flex flex-col h-dvh lg:h-[calc(100dvh-64px)]" style={{ background: "var(--bg-screening)" }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "var(--bg-card)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-lg transition hover:bg-glass-6" aria-label="Back">
          <svg className="w-5 h-5" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {other ? (
          <Link href={`/profile/${other.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              {other.avatarUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={other.avatarUrl} alt={other.name} className="w-full h-full object-cover" />
                : other.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{other.name}</p>
              <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>@{other.username}</p>
            </div>
          </Link>
        ) : (
          <div className="flex-1 h-4 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {thread.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              className="w-6 h-6 rounded-full border-2"
              style={{ borderColor: "var(--cta-primary)", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm mt-12" style={{ color: "var(--text-faint)" }}>
            No messages yet. Send the first one!
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}
              >
                {!msg.mine && (
                  <div
                    className="w-7 h-7 rounded-full shrink-0 mr-2 overflow-hidden flex items-center justify-center text-xs font-semibold self-end"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                  >
                    {msg.sender.avatarUrl
                      ? // eslint-disable-next-line @next/next/no-img-element
                        <img src={msg.sender.avatarUrl} alt={msg.sender.name} className="w-full h-full object-cover" />
                      : msg.sender.name[0]?.toUpperCase()}
                  </div>
                )}
                <div
                  className="max-w-[72%] rounded-2xl px-4 py-2.5"
                  style={
                    msg.mine
                      ? { background: "var(--cta-primary)", color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.07)", borderBottomLeftRadius: 4 }
                  }
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p
                    className="text-[10px] mt-1 text-right"
                    style={{ color: msg.mine ? "rgba(255,255,255,0.6)" : "var(--text-faint)" }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 flex items-end gap-2 px-4 py-3 border-t"
        style={{ background: "var(--bg-card)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-primary)",
            maxHeight: 120,
            lineHeight: "1.4",
          }}
          disabled={!user}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || send.isPending || !user}
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-40"
          style={{ background: "var(--cta-primary)" }}
          aria-label="Send"
        >
          <svg className="w-4 h-4" style={{ color: "#fff" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
