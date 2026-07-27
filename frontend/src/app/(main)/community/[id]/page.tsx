"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import PostTypeBadge from "@/components/community/PostTypeBadge";
import type { Post, PostReply } from "@/types/posts";

export default function PostThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [replyBody, setReplyBody] = useState("");

  const post = useQuery<Post>({
    queryKey: ["post", id],
    queryFn: () => apiFetch(`/api/posts/${id}`),
  });

  const replies = useQuery<{ items: PostReply[] }>({
    queryKey: ["post-replies", id],
    queryFn: () => apiFetch(`/api/posts/${id}/replies`),
  });

  const upvote = useMutation({
    mutationFn: () => apiFetch(`/api/posts/${id}/upvote`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post", id] }),
  });

  const addReply = useMutation({
    mutationFn: () =>
      apiFetch(`/api/posts/${id}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: replyBody.trim() }),
      }),
    onSuccess: () => {
      setReplyBody("");
      qc.invalidateQueries({ queryKey: ["post-replies", id] });
      qc.invalidateQueries({ queryKey: ["post", id] });
    },
  });

  if (post.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
      </div>
    );
  }

  if (!post.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Post not found.</p>
      </div>
    );
  }

  const p = post.data;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24 space-y-4">
      {/* back */}
      <button
        onClick={() => router.back()}
        className="text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        ← Community
      </button>

      {/* post */}
      <article
        className="rounded-xl p-5"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/profile/${p.user.username}`} className="flex items-center gap-2">
            <Avatar name={p.user.name} avatarUrl={p.user.avatarUrl} size="md" />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {p.user.name}
            </span>
          </Link>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            · {timeAgo(p.createdAt)}
          </span>
          <span className="ml-auto">
            <PostTypeBadge type={p.postType} />
          </span>
        </div>

        {p.title && (
          <h1 className="text-base font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            {p.title}
          </h1>
        )}

        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {p.body}
        </p>

        <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: "var(--text-faint)" }}>
          <button
            onClick={() => upvote.mutate()}
            className="flex items-center gap-1 font-semibold transition-colors"
            style={{ color: p.myUpvote ? "var(--cta-primary)" : "var(--text-faint)" }}
          >
            ▲ {p.upvoteCount} upvote{p.upvoteCount !== 1 ? "s" : ""}
          </button>
          <span>{p.replyCount} {p.replyCount === 1 ? "reply" : "replies"}</span>
        </div>
      </article>

      {/* reply composer */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder="Write a reply…"
          maxLength={2000}
          rows={3}
          className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[var(--text-faint)]"
          style={{ color: "var(--text-primary)" }}
        />
        <div className="flex justify-end">
          <button
            onClick={() => addReply.mutate()}
            disabled={!replyBody.trim() || addReply.isPending}
            className="px-4 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--cta-gradient)", color: "#fff" }}
          >
            {addReply.isPending ? "Posting…" : "Reply"}
          </button>
        </div>
      </div>

      {/* replies */}
      {replies.data && replies.data.items.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            {replies.data.items.length} {replies.data.items.length === 1 ? "Reply" : "Replies"}
          </p>
          {replies.data.items.map((r) => (
            <ReplyCard key={r.id} reply={r} postId={id} />
          ))}
        </section>
      )}

      {replies.data?.items.length === 0 && (
        <p
          className="text-sm text-center rounded-xl p-6"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          No replies yet. Be the first.
        </p>
      )}
    </div>
  );
}

function ReplyCard({ reply, postId }: { reply: PostReply; postId: string }) {
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: () =>
      apiFetch(`/api/posts/${postId}/replies/${reply.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Link href={`/profile/${reply.user.username}`} className="flex items-center gap-2">
          <Avatar name={reply.user.name} avatarUrl={reply.user.avatarUrl} size="xs" />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {reply.user.name}
          </span>
        </Link>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          · {timeAgo(reply.createdAt)}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
        {reply.body}
      </p>
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
