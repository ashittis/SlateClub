"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import StarRating from "@/components/ratings/StarRating";
import { formatViewingDate, WATCH_TYPE_LABELS, type WatchType } from "@/lib/api/diary";
import { CheckIcon, HeartIcon, LockIcon, RewatchIcon } from "./logIcons";

gsap.registerPlugin(useGSAP);

/**
 * What the panel becomes for a moment after a successful log.
 *
 * KASET.md §6 names log confirmation as one of exactly two places a GSAP
 * timeline is warranted, and this is it — the payoff for a deliberate act. It
 * reads back what was recorded rather than saying "Saved", because the useful
 * confirmation is seeing the viewing, not being told it exists.
 *
 * Reduced motion resolves the whole thing to its end state immediately, using
 * the same `matchMedia` bail as StarRating.
 */
export default function LogConfirmation({
  watchedOn,
  rating,
  liked,
  isRewatch,
  isPrivate,
  watchType,
  tags,
}: {
  watchedOn: string;
  rating: number;
  liked: boolean;
  isRewatch: boolean;
  isPrivate: boolean;
  watchType: WatchType;
  tags: string[];
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const marks = gsap.utils.toArray<HTMLElement>(".log-confirm-line");
      if (reduce) {
        gsap.set(marks, { opacity: 1, y: 0 });
        return;
      }
      gsap
        .timeline()
        .from(".log-confirm-rule", { scaleX: 0, transformOrigin: "left center", duration: 0.4, ease: "power3.out" })
        .from(".log-confirm-check", { scale: 0.4, opacity: 0, duration: 0.3, ease: "back.out(2)" }, "-=0.2")
        .from(marks, { y: 6, opacity: 0, duration: 0.28, stagger: 0.06, ease: "power2.out" }, "-=0.12");
    },
    { scope: root },
  );

  const modifiers = [
    liked && { key: "liked", icon: <HeartIcon filled className="h-4 w-4" />, label: "Liked" },
    isRewatch && { key: "rewatch", icon: <RewatchIcon className="h-4 w-4" />, label: "Rewatch" },
    isPrivate && { key: "private", icon: <LockIcon className="h-4 w-4" />, label: "Private" },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string }[];

  return (
    <div ref={root} className="p-4" style={{ color: "var(--acid)" }}>
      <div
        className="log-confirm-rule mb-3 h-px w-full"
        style={{ background: "var(--acid)" }}
      />

      <div className="flex items-center gap-2">
        <span className="log-confirm-check">
          <CheckIcon />
        </span>
        <span className="section-label" style={{ color: "var(--acid)" }}>
          Logged
        </span>
      </div>

      <div className="log-confirm-line mt-3 flex items-center gap-3">
        {rating > 0 && <StarRating value={rating} readonly size="md" />}
        <span className="meta" style={{ color: "var(--chalk)" }}>
          {formatViewingDate(watchedOn)} · {WATCH_TYPE_LABELS[watchType]}
        </span>
      </div>

      {modifiers.length > 0 && (
        <ul className="log-confirm-line mt-2 flex flex-wrap items-center gap-3">
          {modifiers.map((m) => (
            <li key={m.key} className="meta flex items-center gap-1.5" style={{ color: "var(--xerox)" }}>
              {m.icon}
              {m.label}
            </li>
          ))}
        </ul>
      )}

      {tags.length > 0 && (
        <p className="log-confirm-line meta mt-2" style={{ color: "var(--xerox)" }}>
          {tags.map((t) => `#${t}`).join("  ")}
        </p>
      )}
    </div>
  );
}
