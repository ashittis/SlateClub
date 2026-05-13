"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const MAX = 280;

interface Props {
  tmdbId?: number | null;
  invalidateKey?: unknown[];
  placeholder?: string;
}

export default function HotTakeComposer({
  tmdbId = null,
  invalidateKey,
  placeholder = "What's your hot take?",
}: Props) {
  const [body, setBody] = useState("");
  const qc = useQueryClient();

  const post = useMutation({
    mutationFn: (text: string) =>
      apiFetch("/api/hot-takes", {
        method: "POST",
        body: JSON.stringify({ body: text, tmdbId }),
      }),
    onSuccess: () => {
      setBody("");
      if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: ["hot-takes"] });
    },
  });

  const remaining = MAX - body.length;
  const canSend = body.trim().length > 0 && remaining >= 0 && !post.isPending;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX + 20))}
        placeholder={placeholder}
        rows={2}
        className="w-full bg-transparent resize-none focus:outline-none text-sm"
        style={{ color: "var(--text-primary)" }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span
          className="text-xs"
          style={{
            color:
              remaining < 0
                ? "var(--signal-error)"
                : remaining < 30
                  ? "var(--pill-mood)"
                  : "var(--text-faint)",
          }}
        >
          {remaining}
        </span>
        <button
          type="button"
          onClick={() => canSend && post.mutate(body.trim())}
          disabled={!canSend}
          className="px-4 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
          style={{
            background: "var(--cta-primary)",
            color: "var(--bg-screening)",
          }}
        >
          Post
        </button>
      </div>
    </div>
  );
}
