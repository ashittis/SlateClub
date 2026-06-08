"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import MatchCutGrid from "@/components/match-cut/MatchCutGrid";
import FriendMultiPicker, { type UserLite } from "@/components/match-cut/FriendMultiPicker";
import { useAuthStore } from "@/stores/authStore";
import type { MatchCutDetail } from "@/types/user";

export default function CutDetailPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const joinToken = useSearchParams().get("join");
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [invitees, setInvitees] = useState<UserLite[]>([]);
  const [copied, setCopied] = useState(false);

  const cut = useQuery<MatchCutDetail>({
    queryKey: ["cut", id],
    queryFn: () => apiFetch(`/api/match-cut/cuts/${id}`),
    enabled: !!id,
  });

  const join = useMutation({
    mutationFn: () =>
      apiFetch(`/api/match-cut/cuts/${id}/join`, {
        method: "POST",
        body: JSON.stringify({ token: joinToken }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cut", id] }),
  });

  // Auto-join when arriving via an invite link and not yet a member.
  useEffect(() => {
    if (joinToken && cut.data && !cut.data.isMember && !join.isPending) {
      join.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinToken, cut.data?.isMember]);

  const invite = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/match-cut/cuts/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
  });

  const del = useMutation({
    mutationFn: () => apiFetch(`/api/match-cut/cuts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-cuts"] });
      router.push("/match-cut");
    },
  });

  const sendInvites = async () => {
    await Promise.all(invitees.map((u) => invite.mutateAsync(u.id)));
    setInvitees([]);
  };

  const inviteLink =
    typeof window !== "undefined" && cut.data
      ? `${window.location.origin}/match-cut/${id}?join=${cut.data.inviteToken}`
      : "";

  const copy = () => {
    if (!inviteLink) return;
    navigator.clipboard?.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (cut.isLoading) {
    return <div className="mx-auto max-w-4xl px-4 pt-10"><div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--bg-card)" }} /></div>;
  }
  if (!cut.data) {
    return <p className="px-4 pt-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>Cut not found.</p>;
  }

  const d = cut.data;
  const isGroup = d.members.length >= 2;

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 pt-6 pb-24">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {d.title}
          </h1>
          {d.isCreator && (
            <button
              onClick={() => del.mutate()}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              Delete
            </button>
          )}
        </div>
        {/* Member avatars */}
        <div className="mt-3 flex items-center gap-2">
          {d.members.map((m) => (
            <span
              key={m.userId}
              title={m.name}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}
            >
              {m.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.avatarUrl} alt={m.name} className="h-full w-full rounded-full object-cover" />
              ) : (
                m.name[0]?.toUpperCase()
              )}
            </span>
          ))}
          <span className="ml-1 text-xs" style={{ color: "var(--text-faint)" }}>
            {d.members.length} {d.members.length === 1 ? "member" : "members"}
          </span>
        </div>
      </header>

      {/* Invite link */}
      <div className="mb-5 rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="mb-2 text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          Invite link
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={inviteLink}
            className="flex-1 truncate rounded-xl px-3 py-2 text-sm"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            onClick={copy}
            className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--cta-gradient)" }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>

      {/* Invite orbits directly */}
      {d.isMember && (
        <div className="mb-8 rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="mb-3 text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Invite from your orbit
          </p>
          <FriendMultiPicker meId={me?.id ?? null} value={invitees} onChange={setInvitees} />
          {invitees.length > 0 && (
            <button
              onClick={sendInvites}
              disabled={invite.isPending}
              className="mt-3 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--cta-gradient)" }}
            >
              Send {invitees.length} invite{invitees.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Consensus */}
      <h2 className="display mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {isGroup ? "Consensus picks" : "Picks for this cut"}
      </h2>
      {!isGroup && (
        <p className="mb-3 text-sm" style={{ color: "var(--text-faint)" }}>
          Invite a friend to blend your tastes — the consensus sharpens with every member.
        </p>
      )}
      <MatchCutGrid items={d.items} group={isGroup} />
    </div>
  );
}
