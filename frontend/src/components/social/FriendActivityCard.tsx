"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FilmCard, { type FilmCardFilm } from "@/components/film/FilmCard";
import StarRating from "@/components/ratings/StarRating";
import { describeActivity, type ActivityEvent } from "@/lib/api/activity";

/**
 * One friend's viewing, as a poster.
 *
 * The home feed used to render this as a line of text — "Priya rated Rang De
 * Basanti". That is a log entry, not a feed: it reads as a changelog of other
 * people's admin. A film is a picture, and the picture is the reason you stop
 * scrolling. So the poster leads, the person is a chip along its foot, and the
 * rating and date sit underneath in mono.
 *
 * Two links, deliberately: the poster goes to the film, the chip goes to the
 * person. They are stacked rather than nested because an anchor inside an
 * anchor is invalid HTML and leaves the inner one unreachable by keyboard.
 */
export default function FriendActivityCard({
  event,
  width = 132,
  onQuickActions,
}: {
  event: ActivityEvent;
  width?: number;
  onQuickActions?: (film: FilmCardFilm) => void;
}) {
  const rating =
    typeof event.metadata?.rating === "number" ? (event.metadata.rating as number) : null;

  const film: FilmCardFilm = {
    tmdbId: event.movie.tmdbId,
    title: event.movie.title,
    posterPath: event.movie.posterPath,
  };

  return (
    <div style={{ width }}>
      <FilmCard
        film={film}
        width={width}
        onQuickActions={onQuickActions}
        caption={null}
      />

      <Link
        href={`/passport/${event.user.username}`}
        aria-label={`${event.user.name} — ${describeActivity(event)} ${event.movie.title}`}
        className="row-hover flex items-center gap-1.5 border border-t-0 px-1.5 py-1"
        style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
      >
        <Avatar avatarUrl={event.user.avatar_url} name={event.user.name} size="xs" />
        <span className="truncate text-[11px] font-medium">{event.user.username}</span>
      </Link>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        {rating ? (
          <StarRating value={rating} readonly size="sm" />
        ) : (
          <span className="meta truncate">{describeActivity(event)}</span>
        )}
        <span className="meta shrink-0">{shortDate(event.createdAt)}</span>
      </div>
    </div>
  );
}

/** "Aug 19" — the feed's own date format, matching the reference. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
