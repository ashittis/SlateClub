"use client";

import Link from "next/link";
import { tmdbImage } from "../../lib/api";
import type { ActivityEvent } from "../../types/social";
import StarRating from "@/components/ratings/StarRating";

const ACTION_LABEL: Record<string, string> = {
  watched: "watched",
  watchlisted: "shelved",
  reviewed: "reviewed",
};

interface Props {
  events: ActivityEvent[];
  emptyText?: string;
}

/*
  Poster-card feed: each item is poster → username → rating (vertical),
  matching the profile ratings look. A "rated" event shows the star value;
  other activity (watched/shelved/reviewed) shows its action label.
*/
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
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {events.map((event) => {
        if (!event.movie) return null;
        const rating =
          event.type === "rated"
            ? (event.metadata?.rating as number | undefined)
            : undefined;
        return (
          <div key={event.id}>
            <Link href={`/film/${event.movie.tmdbId}`} className="group block">
              <div
                className="aspect-[2/3] overflow-hidden rounded-lg"
                style={{ background: "var(--bg-elevated)" }}
              >
                {event.movie.posterPath && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tmdbImage(event.movie.posterPath, "w300")}
                    alt={event.movie.title ?? ""}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
              </div>
            </Link>

            <Link
              href={`/profile/${event.user.username}`}
              className="mt-1.5 block truncate text-xs hover:opacity-90"
              style={{ color: "var(--text-muted)" }}
            >
              @{event.user.username}
            </Link>

            {rating != null ? (
              <div className="mt-0.5">
                <StarRating value={rating} readonly size="sm" />
              </div>
            ) : (
              <p
                className="truncate text-xs"
                style={{ color: "var(--text-faint)" }}
              >
                {ACTION_LABEL[event.type] ?? event.type}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
