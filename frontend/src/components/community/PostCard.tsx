"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Post } from "@/types/posts";

interface Props {
  post: Post;
}

export default function PostCard({ post }: Props) {
  const qc = useQueryClient();

  const upvote = useMutation({
    mutationFn: () =>
      apiFetch(`/api/posts/${post.id}/upvote`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  return (
    <Link
      href={`/community/${post.id}`}
      className="block rounded-xl p-4 transition-colors hover:border-white/10"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* header */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
        >
          {post.user.name[0]?.toUpperCase()}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {post.user.name}
        </span>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          · {timeAgo(post.createdAt)}
        </span>
        {post.postType === "question" && (
          <span
            className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(255, 138, 0, 0.15)",
              color: "var(--cta-primary)",
            }}
          >
            Q
          </span>
        )}
      </div>

      {/* title */}
      {post.title && (
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          {post.title}
        </p>
      )}

      {/* body */}
      <p
        className="text-sm leading-relaxed line-clamp-3"
        style={{ color: post.title ? "var(--text-muted)" : "var(--text-primary)" }}
      >
        {post.body}
      </p>

      {/* footer */}
      <div
        className="mt-3 flex items-center gap-3 text-xs"
        style={{ color: "var(--text-faint)" }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            upvote.mutate();
          }}
          className="flex items-center gap-1 transition-colors"
          style={{ color: post.myUpvote ? "var(--cta-primary)" : "var(--text-faint)" }}
        >
          ▲ {post.upvoteCount}
        </button>
        <span className="flex items-center gap-1">
          ↩ {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
        </span>
        {post.tmdbId && (
          <span className="ml-auto" style={{ color: "var(--pill-language)" }}>
            Film attached
          </span>
        )}
      </div>
    </Link>
  );
}

function timeAgo(s: string) {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
