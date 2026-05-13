"use client";

import Link from "next/link";
import { tmdbImage } from "../../lib/api";
import type { ActivityEvent } from "../../types/social";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function eventText(event: ActivityEvent): string {
  const meta = event.metadata as Record<string, unknown> | null;
  switch (event.type) {
    case "rated":
      return `rated ${event.movie?.title ?? "a film"} ${meta?.rating ? `${meta.rating}★` : ""}`;
    case "reviewed":
      return `reviewed ${event.movie?.title ?? "a film"}`;
    case "watched":
      return `watched ${event.movie?.title ?? "a film"}`;
    case "watchlisted":
      return `added ${event.movie?.title ?? "a film"} to watchlist`;
    case "followed":
      return "followed someone";
    default:
      return event.type;
  }
}

interface Props {
  events: ActivityEvent[];
  emptyText?: string;
}

export default function ActivityFeed({ events, emptyText }: Props) {
  if (events.length === 0) {
    return (
      <p
        className="py-12 text-center text-sm"
        style={{ color: "var(--text-faint)" }}
      >
        {emptyText ??
          "No activity yet. Follow people to see what they're watching."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-3 rounded-xl p-3"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Link href={`/profile/${event.user.username}`} className="shrink-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-muted)",
              }}
            >
              {event.user.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={event.user.avatar_url}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                event.user.name[0]?.toUpperCase()
              )}
            </div>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              <Link
                href={`/profile/${event.user.username}`}
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {event.user.name}
              </Link>{" "}
              {eventText(event)}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>
              {timeAgo(event.createdAt)}
            </p>
          </div>

          {event.movie?.posterPath && (
            <Link href={`/film/${event.movie.tmdbId}`} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tmdbImage(event.movie.posterPath, "w200")}
                alt={event.movie.title ?? ""}
                className="h-14 w-10 rounded object-cover"
              />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
