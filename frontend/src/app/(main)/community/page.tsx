"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import Pill from "@/components/ui/Pill";
import type { Post } from "@/types/posts";

interface ActiveFestival {
  slug: string;
  name: string;
  city: string | null;
  live: boolean;
}

type Feed = "world" | "network";

export default function CommunityPage() {
  const [feed, setFeed] = useState<Feed>("world");

  const posts = useQuery<{ items: Post[] }>({
    queryKey: ["posts", feed],
    queryFn: () => apiFetch(`/api/posts?feed=${feed}`),
    refetchInterval: 30_000,
  });

  const festivals = useQuery<{ items: ActiveFestival[] }>({
    queryKey: ["festivals-active"],
    queryFn: () => apiFetch("/api/festivals/active"),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Community
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Posts, questions, discussions. Cinema as conversation.
      </p>

      {/* live festivals */}
      {festivals.data && festivals.data.items.length > 0 && (
        <div className="space-y-2 mb-5">
          {festivals.data.items.map((f) => (
            <Link
              key={f.slug}
              href={`/festivals/${f.slug}`}
              className="flex items-center justify-between rounded-xl p-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(224,160,80,0.35)",
              }}
            >
              <div>
                <p className="display text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {f.name}
                </p>
                {f.city && (
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>{f.city}</p>
                )}
              </div>
              <Pill kind="mood" size="sm" interactive={false}>Live now</Pill>
            </Link>
          ))}
        </div>
      )}

      {/* composer */}
      <div className="mb-5">
        <PostComposer />
      </div>

      {/* feed toggle */}
      <div
        className="inline-flex rounded-full p-1 gap-1 mb-5"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {(["world", "network"] as Feed[]).map((f) => {
          const active = feed === f;
          return (
            <button
              key={f}
              onClick={() => setFeed(f)}
              className="px-4 py-1.5 text-xs font-semibold rounded-full capitalize"
              style={{
                background: active ? "var(--text-primary)" : "transparent",
                color: active ? "var(--bg-screening)" : "var(--text-muted)",
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* posts feed */}
      <section className="space-y-3">
        {posts.isLoading && (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
        )}
        {posts.data?.items.length === 0 && (
          <p
            className="text-sm rounded-xl p-6 text-center"
            style={{
              color: "var(--text-faint)",
              background: "var(--bg-card)",
              border: "1px dashed rgba(255,255,255,0.06)",
            }}
          >
            {feed === "network"
              ? "Follow people to see their posts."
              : "Nothing yet. Start the conversation."}
          </p>
        )}
        {posts.data?.items.map((p) => <PostCard key={p.id} post={p} />)}
      </section>
    </div>
  );
}
