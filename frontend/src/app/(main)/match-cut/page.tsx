"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import BlendInvite from "@/components/match-cut/BlendInvite";
import type { UserLite } from "@/components/match-cut/FriendMultiPicker";
import type { MatchCutSummary } from "@/types/user";

export default function MatchCutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [creating, setCreating] = useState(false);

  const cuts = useQuery<{ items: MatchCutSummary[] }>({
    queryKey: ["my-cuts"],
    queryFn: () => apiFetch("/api/match-cut/cuts"),
  });

  const create = useMutation({
    mutationFn: (friend: UserLite) =>
      apiFetch<{ id: string }>("/api/match-cut/cuts", {
        method: "POST",
        body: JSON.stringify({ friendId: friend.id }),
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
            Blend your taste with a friend — see how your film taste lines up.
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
        <div className="mb-6">
          <BlendInvite
            me={me ? { id: me.id, name: me.name, avatarUrl: me.avatar_url } : null}
            pending={create.isPending}
            onInvite={(friend) => create.mutate(friend)}
            onCancel={() => setCreating(false)}
          />
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
