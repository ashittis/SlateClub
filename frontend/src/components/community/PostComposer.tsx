"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PostType } from "@/types/posts";

export default function PostComposer() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [postType, setPostType] = useState<PostType>("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || null,
          body,
          postType,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      setOpen(false);
      setTitle("");
      setBody("");
      setPostType("text");
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl p-4 text-left text-sm transition-colors"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "var(--text-faint)",
        }}
      >
        Share something with the community…
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* type toggle */}
      <div className="flex gap-2">
        {(["text", "question"] as PostType[]).map((t) => (
          <button
            key={t}
            onClick={() => setPostType(t)}
            className="px-3 py-1 rounded-full text-xs font-semibold capitalize"
            style={{
              background: postType === t ? "var(--text-primary)" : "var(--bg-elevated)",
              color: postType === t ? "var(--bg-screening)" : "var(--text-muted)",
            }}
          >
            {t === "question" ? "Ask a question" : "Post"}
          </button>
        ))}
      </div>

      {/* optional title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={postType === "question" ? "What do you want to ask?" : "Title (optional)"}
        maxLength={300}
        className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--text-faint)]"
        style={{ color: "var(--text-primary)" }}
      />

      {/* body */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={postType === "question" ? "Add more context…" : "What's on your mind?"}
        maxLength={5000}
        rows={4}
        className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[var(--text-faint)]"
        style={{ color: "var(--text-primary)" }}
      />

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {body.length}/5000
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 rounded-full text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!body.trim() || create.isPending}
            className="px-4 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40"
            style={{
              background: "var(--cta-gradient)",
              color: "#fff",
            }}
          >
            {create.isPending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
