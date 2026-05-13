"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { HotTake, ReactionKind } from "@/types/discourse";

interface Props {
  take: HotTake;
}

export default function HotTakeCard({ take }: Props) {
  const qc = useQueryClient();

  const react = useMutation({
    mutationFn: (kind: ReactionKind) =>
      apiFetch(`/api/hot-takes/${take.id}/react`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hot-takes"] }),
  });

  return (
    <article
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <header className="flex items-center gap-2 mb-2">
        <Link
          href={`/profile/${take.user.username}`}
          className="flex items-center gap-2"
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
            }}
          >
            {take.user.name[0]?.toUpperCase()}
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {take.user.name}
          </span>
        </Link>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          · {timeAgo(take.createdAt)}
        </span>
        {take.tmdbId && (
          <Link
            href={`/film/${take.tmdbId}`}
            className="ml-auto text-xs font-medium"
            style={{ color: "var(--cta-primary)" }}
          >
            View film →
          </Link>
        )}
      </header>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        {take.body}
      </p>
      <footer className="mt-3 flex items-center gap-1.5">
        <ReactBtn
          label={`♡ ${take.counts.like}`}
          active={take.myReaction === "like"}
          onClick={() => react.mutate("like")}
        />
        <ReactBtn
          label={`Agree · ${take.counts.agree}`}
          active={take.myReaction === "agree"}
          tone="agree"
          onClick={() => react.mutate("agree")}
        />
        <ReactBtn
          label={`Disagree · ${take.counts.disagree}`}
          active={take.myReaction === "disagree"}
          tone="disagree"
          onClick={() => react.mutate("disagree")}
        />
      </footer>
    </article>
  );
}

function ReactBtn({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "agree" | "disagree";
  onClick: () => void;
}) {
  const accent =
    tone === "agree"
      ? "var(--cta-primary)"
      : tone === "disagree"
        ? "var(--nav-active)"
        : "var(--text-primary)";
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
      style={{
        background: active ? accent : "var(--bg-elevated)",
        color: active ? "var(--bg-screening)" : "var(--text-muted)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {label}
    </button>
  );
}

function timeAgo(s: string) {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
