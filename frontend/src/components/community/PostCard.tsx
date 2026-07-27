"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import PostTypeBadge from "@/components/community/PostTypeBadge";
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
        <Avatar name={post.user.name} avatarUrl={post.user.avatarUrl} size="sm" />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {post.user.name}
        </span>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          · {timeAgo(post.createdAt)}
        </span>
        <span className="ml-auto">
          <PostTypeBadge type={post.postType} />
        </span>
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
          <span
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{
              background: "rgba(184,149,106,0.14)",
              color: "var(--pill-language)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M4 4h16v16H4zM4 8h16M8 4v4m8-4v4M8 16v4m8-4v4" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
            Linked film
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
