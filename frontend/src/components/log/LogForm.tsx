"use client";

import { useState } from "react";
import StarRating from "@/components/ratings/StarRating";
import Button from "@/components/ui/Button";
import { diaryApi, todayISO, type WatchType } from "@/lib/api/diary";
import { filmsApi } from "@/lib/api/films";
import type { LogFilm } from "@/stores/logStore";
import LogDateField from "./LogDateField";
import LogToggle from "./LogToggle";
import TagInput from "./TagInput";
import WatchMethodPicker from "./WatchMethodPicker";
import { HeartIcon, LockIcon, RewatchIcon, SpoilerIcon } from "./logIcons";

/**
 * The log fields.
 *
 * The rating leads, because it is the one field almost everybody sets and the
 * only one that rewards a gesture. Then when, then the three modifiers. That is
 * the whole fast path, and it fits above the fold on a phone.
 *
 * **Everything else is behind a disclosure.** Venue, review and tags were
 * previously all visible at once, which made a two-tap action present itself as
 * a seven-field form — people read a form and decide to do it later. They are
 * still one tap away, and the tap is labelled with what is inside so nobody has
 * to go looking.
 *
 * The form owns its own scroll/footer split: the fields scroll, the submit is
 * pinned below them. That belongs here rather than in the host, because "the
 * button is always reachable" is a property of the form, and hosting it
 * elsewhere means every host has to remember to reimplement it.
 */
export default function LogForm({
  film,
  filmId,
  isRewatchDefault,
  onLogged,
}: {
  film: LogFilm;
  /** From `filmsApi.status().filmId`. Only re-fetched if the caller hasn't got it. */
  filmId?: string | null;
  isRewatchDefault: boolean;
  /** Fires with the recorded viewing once the write lands. */
  onLogged: (recorded: RecordedViewing) => void;
}) {
  const [watchedOn, setWatchedOn] = useState(todayISO());
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState(false);
  const [isRewatch, setIsRewatch] = useState(isRewatchDefault);
  const [isPrivate, setIsPrivate] = useState(false);
  const [watchType, setWatchType] = useState<WatchType>("streaming");
  const [review, setReview] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      // The film row is created on demand, so an id is only fetched when the
      // caller's own status query hasn't produced one yet.
      const id = filmId ?? (await filmsApi.status(film.tmdbId)).filmId;
      await diaryApi.log({
        movieId: id,
        watchedOn,
        rating: rating > 0 ? rating : null,
        liked,
        isRewatch,
        watchType,
        tags,
        visibility: isPrivate ? "private" : "public",
        review: review.trim() || undefined,
        reviewSpoiler: spoiler,
      });
      setPending(false);
      onLogged({ watchedOn, rating, liked, isRewatch, isPrivate, watchType, tags });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log this viewing.");
      setPending(false);
    }
  };

  // A summary of what's hidden, so the disclosure is never a mystery box.
  const detailSummary = [
    review.trim() ? "review" : null,
    tags.length ? `${tags.length} ${tags.length === 1 ? "tag" : "tags"}` : null,
    watchType !== "streaming" ? watchType : null,
  ].filter(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <div className="flex flex-col items-center gap-2">
        <StarRating value={rating} onChange={setRating} size="xl" />
        <div className="flex items-center gap-3">
          <span className="meta">
            {rating > 0 ? `${rating} / 5` : "Drag to rate — or don't"}
          </span>
          {rating > 0 && (
            <button
              type="button"
              onClick={() => setRating(0)}
              className="meta underline"
              style={{ color: "var(--blood-ink)" }}
            >
              clear
            </button>
          )}
        </div>
      </div>

      <LogDateField value={watchedOn} onChange={setWatchedOn} />

      <div className="grid grid-cols-3 gap-1.5">
        <LogToggle
          icon={<HeartIcon filled={liked} />}
          label="Liked"
          pressed={liked}
          onChange={setLiked}
        />
        <LogToggle
          icon={<RewatchIcon />}
          label="Rewatch"
          pressed={isRewatch}
          onChange={setIsRewatch}
        />
        <LogToggle
          icon={<LockIcon />}
          label="Private"
          pressed={isPrivate}
          onChange={setIsPrivate}
        />
      </div>

      <div className="border-t pt-4" style={{ borderColor: "var(--edge)" }}>
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          aria-expanded={detailsOpen}
          className="flex min-h-[44px] w-full items-center justify-between text-sm font-medium"
          style={{ color: "var(--chalk)" }}
        >
          <span>Add review, venue, tags</span>
          <span className="flex items-center gap-2">
            {!detailsOpen && detailSummary.length > 0 && (
              <span className="meta">{detailSummary.join(" · ")}</span>
            )}
            <Chevron open={detailsOpen} />
          </span>
        </button>

        {detailsOpen && (
          <div className="mt-4 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="section-label">How you watched it</span>
              <WatchMethodPicker value={watchType} onChange={setWatchType} />
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                placeholder="What did you think? (optional)"
                aria-label="Review"
                className="w-full border p-3 text-sm outline-none"
                style={{ borderColor: "var(--edge)", background: "var(--void)" }}
              />
              {/* Only meaningful once there is something to spoil. */}
              {review.trim() && (
                <LogToggle
                  layout="inline"
                  icon={<SpoilerIcon />}
                  label="Contains spoilers"
                  pressed={spoiler}
                  onChange={setSpoiler}
                />
              )}
            </div>

            <TagInput tags={tags} onChange={setTags} />
          </div>
        )}
      </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--signal-error)" }}>
            {error}
          </p>
        )}
      </div>

      {/* Pinned. Never inside the scroll area. */}
      <div
        className="shrink-0 border-t p-4"
        style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
      >
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Logging…" : "Log it"}
        </Button>
      </div>
    </div>
  );
}

export interface RecordedViewing {
  watchedOn: string;
  rating: number;
  liked: boolean;
  isRewatch: boolean;
  isPrivate: boolean;
  watchType: WatchType;
  tags: string[];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: open ? "rotate(180deg)" : undefined,
        transition: "transform 150ms ease",
        color: "var(--xerox)",
      }}
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}
