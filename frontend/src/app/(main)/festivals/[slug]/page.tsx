"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import Pill from "@/components/ui/Pill";

interface Festival {
  slug: string;
  name: string;
  city: string | null;
  startsAt: string;
  endsAt: string;
  bannerUrl: string | null;
  description: string | null;
  live: boolean;
}

interface FestivalPost {
  id: string;
  body: string;
  tmdbId: number | null;
  createdAt: string;
  user: { id: string; name: string; username: string; avatarUrl: string | null };
}

export default function FestivalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const fest = useQuery<Festival>({
    queryKey: ["festival", slug],
    queryFn: () => apiFetch(`/api/festivals/${slug}`),
  });

  const posts = useQuery<{ items: FestivalPost[] }>({
    queryKey: ["festival-posts", slug],
    queryFn: () => apiFetch(`/api/festivals/${slug}/posts`),
    refetchInterval: 30_000,
  });

  const post = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/festivals/${slug}/posts`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["festival-posts", slug] });
    },
  });

  if (fest.isLoading || !fest.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div
          className="h-32 rounded-2xl animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
      </div>
    );
  }

  const f = fest.data;

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <div
        className="relative -mx-4 lg:-mx-6 h-44 overflow-hidden mb-5"
        style={{ background: "var(--bg-elevated)" }}
      >
        {f.bannerUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={f.bannerUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, var(--bg-screening) 100%)",
          }}
        />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <h1
              className="display text-2xl lg:text-3xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {f.name}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              {f.city ? `${f.city} · ` : ""}
              {new Date(f.startsAt).toLocaleDateString()} —{" "}
              {new Date(f.endsAt).toLocaleDateString()}
            </p>
          </div>
          {f.live && (
            <Pill kind="mood" interactive={false}>
              Live now
            </Pill>
          )}
        </div>
      </div>

      {f.description && (
        <p
          className="text-sm mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          {f.description}
        </p>
      )}

      {f.live && (
        <div
          className="rounded-xl p-4 mb-5"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Post a live update from the festival…"
            rows={2}
            className="w-full bg-transparent resize-none focus:outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
          <div className="flex justify-end">
            <button
              onClick={() => draft.trim() && post.mutate(draft.trim())}
              disabled={!draft.trim() || post.isPending}
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
      )}

      <div className="space-y-3">
        {posts.data && posts.data.items.length === 0 && (
          <p
            className="text-sm rounded-xl p-6 text-center"
            style={{
              color: "var(--text-faint)",
              background: "var(--bg-card)",
              border: "1px dashed rgba(255,255,255,0.06)",
            }}
          >
            No live updates yet.
          </p>
        )}
        {posts.data?.items.map((p) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/profile/${p.user.username}`}
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {p.user.name}
              </Link>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                · {timeAgo(p.createdAt)}
              </span>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            >
              {p.body}
            </p>
            {p.tmdbId && (
              <Link
                href={`/film/${p.tmdbId}`}
                className="text-xs font-medium mt-2 inline-block"
                style={{ color: "var(--cta-primary)" }}
              >
                View film →
              </Link>
            )}
          </motion.article>
        ))}
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
