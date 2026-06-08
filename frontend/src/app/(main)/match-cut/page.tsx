"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { MatchCutSummary } from "@/types/user";

export default function MatchCutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const cuts = useQuery<{ items: MatchCutSummary[] }>({
    queryKey: ["my-cuts"],
    queryFn: () => apiFetch("/api/match-cut/cuts"),
  });

  const create = useMutation({
    mutationFn: (t: string) =>
      apiFetch<{ id: string }>("/api/match-cut/cuts", {
        method: "POST",
        body: JSON.stringify({ title: t }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["my-cuts"] });
      router.push(`/match-cut/${data.id}`);
    },
  });

  const items = cuts.data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 pt-6 pb-24">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Match Cut
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Blend your taste with friends — saved, shareable cuts.
          </p>
        </div>
        <button
          onClick={() => setCreating((c) => !c)}
          className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" }}
        >
          + Create Cut
        </button>
      </div>

      {creating && (
        <div className="mb-6 rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your cut (e.g. Friday Night)"
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-primary)" }}
            onKeyDown={(e) => e.key === "Enter" && create.mutate(title.trim() || "Untitled Cut")}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => create.mutate(title.trim() || "Untitled Cut")}
              disabled={create.isPending}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--cta-gradient)" }}
            >
              {create.isPending ? "Creating…" : "Create cut"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <h2 className="display mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Your Cuts
      </h2>

      {cuts.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>
          No cuts yet. Create one and invite a friend to blend your tastes.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/match-cut/${c.id}`}
              className="rounded-2xl p-4 transition hover:opacity-90"
              style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {c.title}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                {c.isCreator ? " · you created this" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
