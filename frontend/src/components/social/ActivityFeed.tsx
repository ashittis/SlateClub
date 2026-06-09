"use client";

import Link from "next/link";
import { tmdbImage } from "../../lib/api";
import type { ActivityEvent } from "../../types/social";
import StarRating from "@/components/ratings/StarRating";

interface Props {
  events: ActivityEvent[];
  emptyText?: string;
}

/*
  One card per (person, film). Activity for the same film by the same person
  is merged so a rated + reviewed film shows the stars with a small write-up
  glyph, rather than two separate cards. Status rules:
    rated            → star value
    rated + reviewed → star value + review glyph (poster corner)
    reviewed only    → review glyph
    watched (unrated)→ "watched"
    shelved          → never shown
*/
interface MergedCard {
  key: string;
  movie: NonNullable<ActivityEvent["movie"]>;
  user: ActivityEvent["user"];
  rating: number | null;
  hasReview: boolean;
  hasWatched: boolean;
}

function mergeEvents(events: ActivityEvent[]): MergedCard[] {
  const byKey = new Map<string, MergedCard>();
  const order: string[] = [];

  for (const event of events) {
    // Shelved activity never surfaces here.
    if (event.type === "watchlisted" || event.type === "followed") continue;
    if (!event.movie || !event.movieId) continue;

    const key = `${event.userId}-${event.movieId}`;
    let card = byKey.get(key);
    if (!card) {
      card = {
        key,
        movie: event.movie,
        user: event.user,
        rating: null,
        hasReview: false,
        hasWatched: false,
      };
      byKey.set(key, card);
      order.push(key);
    }

    if (event.type === "rated") {
      const value = event.metadata?.rating as number | undefined;
      if (value != null) card.rating = value;
    } else if (event.type === "reviewed") {
      card.hasReview = true;
    } else if (event.type === "watched") {
      card.hasWatched = true;
    }
  }

  // Drop entries that ended up with no displayable signal (e.g. a film whose
  // only activity was shelving, already skipped above).
  return order
    .map((k) => byKey.get(k)!)
    .filter((c) => c.rating != null || c.hasReview || c.hasWatched);
}

export default function ActivityFeed({ events, emptyText }: Props) {
  const cards = mergeEvents(events);

  if (cards.length === 0) {
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
      {cards.map((card) => (
        <div key={card.key}>
          <Link href={`/film/${card.movie.tmdbId}`} className="group block">
            <div
              className="relative aspect-[2/3] overflow-hidden rounded-lg"
              style={{ background: "var(--bg-elevated)" }}
            >
              {card.movie.posterPath && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(card.movie.posterPath, "w300")}
                  alt={card.movie.title ?? ""}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              )}
              {/* Write-up glyph: a rated film that also carries a review. */}
              {card.rating != null && card.hasReview && (
                <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-md bg-black/65 ring-1 ring-white/10">
                  <ReviewGlyph />
                </span>
              )}
            </div>
          </Link>

          <Link
            href={`/profile/${card.user.username}`}
            className="mt-1.5 block truncate text-xs hover:opacity-90"
            style={{ color: "var(--text-muted)" }}
          >
            @{card.user.username}
          </Link>

          {card.rating != null ? (
            <div className="mt-0.5">
              <StarRating value={card.rating} readonly size="sm" />
            </div>
          ) : card.hasReview ? (
            <p
              className="mt-0.5 flex items-center gap-1 truncate text-xs"
              style={{ color: "var(--text-faint)" }}
            >
              <ReviewGlyph />
              reviewed
            </p>
          ) : (
            <p
              className="truncate text-xs"
              style={{ color: "var(--text-faint)" }}
            >
              watched
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* Hand-crafted write-up glyph (pen over a line) — no icon library. */
function ReviewGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "var(--pill-mood)" }}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
