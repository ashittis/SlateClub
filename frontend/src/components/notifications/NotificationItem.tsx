"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Notification } from "@/types/notifications";

interface Props {
  n: Notification;
  onRead?: () => void;
}

interface Actor {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export default function NotificationItem({ n, onRead }: Props) {
  const actor = (n.payload?.actor ?? null) as Actor | null;
  const text = renderText(n);
  const href = renderHref(n);
  const unread = !n.readAt;
  const qc = useQueryClient();

  // Orbit requests answer inline (no navigation).
  const requestId = n.payload?.requestId as string | undefined;
  const respond = useMutation({
    mutationFn: (action: "accept" | "decline") =>
      apiFetch(`/api/orbits/requests/${requestId}/${action}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      onRead?.();
    },
  });

  const orbitStatus = n.payload?.status as string | undefined;
  if (n.kind === "orbit_request" && orbitStatus === "accepted") {
    const inner = (
      <div
        className="flex items-center gap-3 rounded-xl p-3"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Avatar actor={actor} />
        <div className="min-w-0 flex-1">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            ✓ {actor?.name ?? "Someone"} is in your orbit
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
            {timeAgo(n.createdAt)}
          </p>
        </div>
      </div>
    );
    return actor ? (
      <Link href={`/profile/${actor.username}`} className="block">{inner}</Link>
    ) : (
      inner
    );
  }
  if (n.kind === "orbit_request" && orbitStatus === "declined") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl p-3 opacity-70"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Avatar actor={actor} />
        <div className="min-w-0 flex-1">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            You declined {actor?.name ?? "the"} orbit request
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
            {timeAgo(n.createdAt)}
          </p>
        </div>
      </div>
    );
  }
  if (n.kind === "orbit_request" && requestId) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl p-3"
        style={{
          background: unread ? "rgba(255, 138, 0, 0.08)" : "var(--bg-card)",
          border: unread ? "1px solid rgba(255, 138, 0, 0.25)" : "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Avatar actor={actor} />
        <div className="min-w-0 flex-1">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            {actor?.name ?? "Someone"} wants to be in your orbit
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
            {timeAgo(n.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => respond.mutate("accept")}
            disabled={respond.isPending}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--cta-gradient)" }}
          >
            Accept
          </button>
          <button
            onClick={() => respond.mutate("decline")}
            disabled={respond.isPending}
            className="rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  const body = (
    <div
      className="flex items-start gap-3 rounded-xl p-3"
      style={{
        background: unread ? "rgba(255, 138, 0, 0.08)" : "var(--bg-card)",
        border: unread
          ? "1px solid rgba(255, 138, 0, 0.25)"
          : "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: "var(--bg-elevated)",
          color: "var(--text-muted)",
        }}
      >
        {actor?.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={actor.avatarUrl}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          (actor?.name ?? "?")[0]?.toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {text}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
          {timeAgo(n.createdAt)}
        </p>
      </div>
      {unread && (
        <span
          className="w-2 h-2 rounded-full mt-2"
          style={{ background: "var(--cta-primary)" }}
        />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onRead} className="block">
        {body}
      </Link>
    );
  }
  return <button onClick={onRead} className="w-full text-left">{body}</button>;
}

function renderText(n: Notification): string {
  const actor = (n.payload?.actor ?? null) as Actor | null;
  const actorName = actor?.name ?? "Someone";
  switch (n.kind) {
    case "follow":
      return `${actorName} started following you`;
    case "slate_save":
      return `${actorName} saved your slate “${n.payload?.slateTitle}”`;
    case "slate_message": {
      const preview = n.payload?.preview as string | undefined;
      return preview
        ? `${actorName} in “${n.payload?.slateTitle}”: ${preview}`
        : `${actorName} posted in “${n.payload?.slateTitle}”`;
    }
    case "orbit_accepted":
      return `${actorName} accepted your orbit request`;
    case "film_recommend":
      return `${actorName} recommended “${n.payload?.movieTitle ?? "a film"}” to you`;
    case "dm_reaction":
      return `${actorName} reacted “${reactionLabel(n.payload?.reaction as string)}” to ${n.payload?.movieTitle ?? "your pick"}`;
    case "cut_invite":
      return `${actorName} invited you to a Match Cut`;
    case "review_helpful":
      return `${actorName} found your review helpful`;
    case "twin_activity":
      return `${actorName} just added something you might love`;
    case "release":
      return `${(n.payload?.title as string) ?? "A film you tracked"} just released`;
    case "artist":
      return `${(n.payload?.name as string) ?? "An artist you follow"} posted`;
    case "ama":
      return `${(n.payload?.name as string) ?? "An artist"} is going live for an AMA`;
    case "hidden_gem":
      return `Hidden gem: ${n.payload?.title ?? "a film your twins love"}`;
    default:
      return "New activity";
  }
}

function renderHref(n: Notification): string | null {
  const actor = (n.payload?.actor ?? null) as Actor | null;
  switch (n.kind) {
    case "follow":
    case "orbit_accepted":
      return actor ? `/profile/${actor.username}` : null;
    case "film_recommend":
      return "/messages";
    case "dm_reaction":
      return n.payload?.movieId ? `/film/${n.payload.movieId}` : null;
    case "cut_invite":
      return n.payload?.cutId
        ? `/match-cut/${n.payload.cutId}${n.payload?.token ? `?join=${n.payload.token}` : ""}`
        : "/match-cut";
    case "slate_save":
    case "slate_message":
      return n.payload?.slateId ? `/slates/${n.payload.slateId}` : null;
    case "review_helpful":
    case "twin_activity":
    case "release":
    case "hidden_gem":
      return n.payload?.movieId
        ? `/film/${n.payload.movieId}`
        : null;
    default:
      return null;
  }
}

function timeAgo(s: string) {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

const REACTION_LABELS: Record<string, string> = {
  peak: "Peak",
  mid: "Mid",
  never_again: "Never watching again",
  worst_ever: "Worst ever",
  absolute_worst: "Absolute worst",
};

function reactionLabel(r?: string): string {
  return (r && REACTION_LABELS[r]) || "reacted";
}

function Avatar({ actor }: { actor: Actor | null }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
    >
      {actor?.avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={actor.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
      ) : (
        (actor?.name ?? "?")[0]?.toUpperCase()
      )}
    </div>
  );
}
