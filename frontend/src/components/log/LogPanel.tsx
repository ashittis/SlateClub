"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import StarRating from "@/components/ratings/StarRating";
import Button from "@/components/ui/Button";
import { diaryApi, todayISO, type WatchType } from "@/lib/api/diary";
import { filmsApi, type FilmDetail } from "@/lib/api/films";
import LogConfirmation from "./LogConfirmation";
import LogDateField from "./LogDateField";
import LogToggle from "./LogToggle";
import TagInput from "./TagInput";
import WatchMethodPicker from "./WatchMethodPicker";
import { CloseIcon, HeartIcon, LockIcon, RewatchIcon, SpoilerIcon } from "./logIcons";

/** How long the confirmation holds before the panel folds away. */
const CONFIRM_MS = 2200;

/**
 * Logging a viewing — inline, on the film page, with the film still on screen.
 *
 * This deliberately is *not* a modal. A viewing is something you did to the
 * film you are looking at, and dropping a scrim over that film to ask about it
 * broke the connection: you ended up filling in a form about a thing you could
 * no longer see. The panel takes the primary button's place in the layout, so
 * the page never jumps and the poster stays put.
 *
 * The rating leads, because it is the one field almost everybody sets and the
 * only one that rewards a gesture. Everything below it is optional: nothing is
 * required but the film, and "I watched this" is still one tap away.
 *
 * The modifiers — liked, rewatch, private, spoilers — are icon toggles rather
 * than labelled checkbox rows. Four full-width rows reading "This was a
 * rewatch" made a two-tap action look like a tax return.
 */
export default function LogPanel({
  film,
  filmId,
  isRewatchDefault,
  onClose,
  onLogged,
}: {
  film: FilmDetail;
  /** From `filmsApi.status().filmId`. Only re-fetched if the page hasn't got it yet. */
  filmId?: string;
  isRewatchDefault: boolean;
  onClose: () => void;
  /** Fires as soon as the write lands, so the page behind refreshes under the confirmation. */
  onLogged: () => void;
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);

  const root = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  // Bring the panel into view when it opens. It replaces a button that was
  // already on screen, but the panel is much taller than the button was.
  useEffect(() => {
    root.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [reduceMotion]);

  // Escape still closes. The panel is not modal, so this is a convenience for
  // keyboard users rather than the only way out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      // The film row is created on demand, so an id is only fetched when the
      // page's own status query hasn't produced one yet.
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
      setLogged(true);
      // Refresh immediately so the viewing appears in the history below while
      // the confirmation is still showing.
      onLogged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log this viewing.");
      setPending(false);
    }
  };

  // Fold away once the confirmation has been read.
  useEffect(() => {
    if (!logged) return;
    const t = setTimeout(onClose, CONFIRM_MS);
    return () => clearTimeout(t);
  }, [logged, onClose]);

  return (
    <motion.section
      ref={root}
      aria-label={`Log ${film.title}`}
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      className="border"
      style={{ borderColor: "var(--edge-hot)", background: "var(--soot)" }}
    >
      <header
        className="flex items-center justify-between border-b-2 pl-4 pr-1"
        style={{ borderColor: "var(--edge)" }}
      >
        <span className="section-label">
          {logged ? "Viewing recorded" : "You're logging this"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel logging"
          className="flex h-11 w-11 items-center justify-center"
          style={{ color: "var(--xerox)" }}
        >
          <CloseIcon />
        </button>
      </header>

      {logged ? (
        <LogConfirmation
          watchedOn={watchedOn}
          rating={rating}
          liked={liked}
          isRewatch={isRewatch}
          isPrivate={isPrivate}
          watchType={watchType}
          tags={tags}
        />
      ) : (
        <>
          <div className="space-y-5 p-4">
            {/* The rating leads — the one field worth a gesture. */}
            <div
              className="flex flex-col items-center gap-2 border-b-2 pb-5"
              style={{ borderColor: "var(--edge)" }}
            >
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

            <WatchMethodPicker value={watchType} onChange={setWatchType} />

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

            <div className="flex flex-col gap-2">
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={3}
                placeholder="What did you think? (optional)"
                aria-label="Review"
                className="w-full border p-3 text-sm"
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

            {error && (
              <p className="text-sm" style={{ color: "var(--signal-error)" }}>
                {error}
              </p>
            )}
          </div>

          <div
            className="border-t-2 p-4"
            style={{ borderColor: "var(--edge)" }}
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
        </>
      )}
    </motion.section>
  );
}
