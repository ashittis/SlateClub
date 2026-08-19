"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { diaryKeys } from "@/lib/api/diary";
import { libraryKeys } from "@/lib/api/library";
import type { LogFilm } from "@/stores/logStore";
import { useLogStore } from "@/stores/logStore";
import LogConfirmation from "./LogConfirmation";
import LogFilmPicker from "./LogFilmPicker";
import LogForm, { type RecordedViewing } from "./LogForm";
import { CloseIcon } from "./logIcons";

/** How long the confirmation holds before the dialog folds away. */
const CONFIRM_MS = 2200;

/**
 * The one log surface in the app.
 *
 * Mounted once in `(main)/layout.tsx`; opened from the top bar's Create menu, a
 * film page, or a poster's quick actions, all through `stores/logStore.ts`.
 *
 * ── On why this is a dialog now ───────────────────────────────────────────
 * The previous version was an inline panel that took the primary button's place
 * on the film page, deliberately avoiding a modal so you never filled in a form
 * about a film you could no longer see. That goal was right; the mechanism had
 * two costs. It only existed on the film page, so logging could not start from
 * anywhere else. And on desktop it rendered as a narrow column in a wide page,
 * with the poster scrolled off above it — the exact disconnection it was built
 * to prevent.
 *
 * The dialog keeps the film in frame by *carrying it*: the poster and title sit
 * in their own column, always visible, whatever page you opened from. On mobile
 * it is a bottom sheet with the submit pinned above the fold, so "I watched
 * this" stays a two-tap action.
 */
export default function LogDialog() {
  const { open, film, filmId, isRewatch, onLogged, closeLog } = useLogStore();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();

  // A film chosen inside the dialog, when it was opened without one.
  const [picked, setPicked] = useState<LogFilm | null>(null);
  const [recorded, setRecorded] = useState<RecordedViewing | null>(null);

  const active = film ?? picked;

  // Reset per opening, not per close, so the exit animation plays against the
  // content that was there. Adjusted during render rather than in an effect —
  // an effect would show the *previous* film for one frame each time the dialog
  // reopens, which is exactly the confusion this surface must not create.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPicked(null);
      setRecorded(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeLog();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, closeLog]);

  // Fold away once the confirmation has been read.
  useEffect(() => {
    if (!recorded) return;
    const t = setTimeout(closeLog, CONFIRM_MS);
    return () => clearTimeout(t);
  }, [recorded, closeLog]);

  const handleLogged = (viewing: RecordedViewing) => {
    setRecorded(viewing);
    // The diary and watchlist change on every log, wherever it started from —
    // the dialog owns those. Anything page-specific is the opener's business.
    queryClient.invalidateQueries({ queryKey: diaryKeys.all() });
    queryClient.invalidateQueries({ queryKey: libraryKeys.watchlist() });
    onLogged?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(10, 9, 13, 0.78)" }}
            onClick={closeLog}
            aria-hidden
          />

          <motion.section
            role="dialog"
            aria-modal
            aria-label={active ? `Log ${active.title}` : "Log a film"}
            initial={reduceMotion ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className="relative z-10 flex max-h-[92vh] w-full flex-col border sm:max-h-[86vh] sm:max-w-3xl"
            style={{ borderColor: "var(--edge-hot)", background: "var(--soot)" }}
          >
            <header
              className="flex shrink-0 items-center justify-between border-b pl-4 pr-1"
              style={{ borderColor: "var(--edge)" }}
            >
              <span className="section-label">
                {recorded
                  ? "Viewing recorded"
                  : active
                    ? "You're logging this"
                    : "Log a film"}
              </span>
              <button
                type="button"
                onClick={closeLog}
                aria-label="Cancel logging"
                className="flex h-11 w-11 items-center justify-center"
                style={{ color: "var(--xerox)" }}
              >
                <CloseIcon />
              </button>
            </header>

            {recorded ? (
              <div className="overflow-y-auto">
                <LogConfirmation {...recorded} />
              </div>
            ) : active ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
                {/* The film, held in frame for the whole interaction. */}
                <div
                  className="flex shrink-0 items-center gap-3 border-b p-4 sm:w-[240px] sm:flex-col sm:items-start sm:border-b-0 sm:border-r"
                  style={{ borderColor: "var(--edge)" }}
                >
                  <Image
                    src={tmdbImage(active.posterPath, "w300")}
                    alt=""
                    width={200}
                    height={300}
                    className="poster w-[56px] shrink-0 object-cover sm:w-full"
                    unoptimized
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight sm:text-base">
                      {active.title}
                    </p>
                    <p className="meta mt-0.5">{active.year ?? "—"}</p>
                  </div>
                </div>

                {/* LogForm scrolls its own fields and pins its own submit. */}
                <LogForm
                  film={active}
                  filmId={filmId}
                  isRewatchDefault={isRewatch}
                  onLogged={handleLogged}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-4">
                <LogFilmPicker onPick={setPicked} />
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
