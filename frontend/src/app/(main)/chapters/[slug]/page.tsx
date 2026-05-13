"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Chapter {
  slug: string;
  name: string;
  city: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  tmdbId: number | null;
}

export default function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const qc = useQueryClient();

  const chapter = useQuery<Chapter>({
    queryKey: ["chapter", slug],
    queryFn: () => apiFetch(`/api/chapters/${slug}`),
  });

  const events = useQuery<{ items: Event[] }>({
    queryKey: ["chapter-events", slug],
    queryFn: () => apiFetch(`/api/chapters/${slug}/events`),
  });

  const join = useMutation({
    mutationFn: (currentlyMember: boolean) =>
      apiFetch(
        `/api/chapters/${slug}/join`,
        { method: currentlyMember ? "DELETE" : "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter", slug] }),
  });

  if (!chapter.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div
          className="h-32 rounded-2xl animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
      </div>
    );
  }

  const c = chapter.data;

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--pill-language)" }}
          >
            {c.city}
          </p>
          <h1
            className="display text-2xl lg:text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {c.name}
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            {c.memberCount} members
          </p>
        </div>
        <button
          onClick={() => join.mutate(c.isMember)}
          className="px-4 py-2 rounded-full text-xs font-semibold"
          style={{
            background: c.isMember ? "var(--bg-elevated)" : "var(--cta-primary)",
            color: c.isMember ? "var(--text-primary)" : "var(--bg-screening)",
            border: c.isMember
              ? "1px solid rgba(255,255,255,0.06)"
              : "none",
          }}
        >
          {c.isMember ? "Joined" : "Join"}
        </button>
      </div>

      {c.description && (
        <p
          className="text-sm mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          {c.description}
        </p>
      )}

      <h2
        className="display text-sm font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-faint)" }}
      >
        Upcoming events
      </h2>
      {events.data && events.data.items.length === 0 && (
        <p
          className="text-sm rounded-xl p-6 text-center"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          No upcoming events.
        </p>
      )}
      <div className="space-y-3">
        {events.data?.items.map((e) => (
          <article
            key={e.id}
            className="rounded-xl p-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p
                className="display font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {e.title}
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {new Date(e.startsAt).toLocaleString()}
              </p>
            </div>
            {e.venue && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {e.venue}
              </p>
            )}
            {e.description && (
              <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                {e.description}
              </p>
            )}
            {e.tmdbId && (
              <Link
                href={`/film/${e.tmdbId}`}
                className="text-xs font-medium mt-2 inline-block"
                style={{ color: "var(--cta-primary)" }}
              >
                View film →
              </Link>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
