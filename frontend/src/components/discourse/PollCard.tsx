"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import type { Poll } from "@/types/discourse";

interface Props {
  poll: Poll;
}

export default function PollCard({ poll }: Props) {
  const qc = useQueryClient();
  const vote = useMutation({
    mutationFn: (optionIndex: number) =>
      apiFetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ option_index: optionIndex }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["polls"] }),
  });

  const total = poll.totalVotes || 1;
  const closed = poll.closesAt && new Date(poll.closesAt) < new Date();
  const showResults = poll.myVote !== null || closed;

  return (
    <article
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <h3
        className="display text-base font-semibold mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        {poll.question}
      </h3>
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = poll.counts[i] ?? 0;
          const pct = Math.round((count / total) * 100);
          const isMine = poll.myVote === i;
          return (
            <button
              key={i}
              onClick={() => !closed && vote.mutate(i)}
              disabled={!!closed}
              className="relative w-full text-left rounded-lg overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                border: isMine
                  ? "1px solid var(--cta-primary)"
                  : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {showResults && (
                <motion.div
                  className="absolute inset-y-0 left-0"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    background: isMine
                      ? "rgba(92,165,114,0.3)"
                      : "rgba(255,255,255,0.05)",
                  }}
                />
              )}
              <div className="relative px-3 py-2.5 flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {opt}
                </span>
                {showResults && (
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p
        className="mt-3 text-xs"
        style={{ color: "var(--text-faint)" }}
      >
        {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
        {closed ? " · closed" : ""}
      </p>
    </article>
  );
}
