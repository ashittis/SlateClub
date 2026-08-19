"use client";

import StarRating from "@/components/ratings/StarRating";
import type { FilmStatus } from "@/lib/api/films";

/**
 * Everything you can do to a film, in one panel.
 *
 * These actions used to be scattered down the page — a full-width button here,
 * a rating row two sections later, share somewhere below the fold — so the page
 * read as an article with controls sprinkled through it. Collected into a
 * single column they read as what they are: a control surface, parked beside
 * the film and staying put while you scroll the writing.
 *
 * On desktop this is the right-hand column. Below `lg` it moves inline, under
 * the poster, and the film page pins the primary action to the bottom of the
 * viewport instead — a sidebar you have to scroll to is not a sidebar.
 *
 * Only one thing here is filled: logging. Everything else is a quiet row.
 */
export default function FilmActionPanel({
  status,
  onLog,
  onRate,
  onToggleWatchlist,
  onShare,
}: {
  status: FilmStatus | undefined;
  onLog: () => void;
  onRate: (value: number) => void;
  onToggleWatchlist: () => void;
  onShare: () => void;
}) {
  const seen = status?.seen ?? false;
  const inWatchlist = status?.inWatchlist ?? false;

  return (
    <aside
      className="border"
      style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
      aria-label="Film actions"
    >
      {/* The triad — the three states a film can be in relative to you. */}
      <div
        className="grid grid-cols-3 border-b"
        style={{ borderColor: "var(--edge)" }}
      >
        <StateCell
          label={seen ? "Watched" : "Log"}
          active={seen}
          onClick={onLog}
          icon={<EyeIcon filled={seen} />}
        />
        <StateCell
          label="Rate"
          active={(status?.rating ?? 0) > 0}
          onClick={() => {
            // The stars are directly below; move focus rather than duplicating
            // the control in two places.
            document.getElementById("film-rating")?.focus();
          }}
          icon={<StarMark filled={(status?.rating ?? 0) > 0} />}
          className="border-x"
        />
        <StateCell
          label={inWatchlist ? "Saved" : "Watchlist"}
          active={inWatchlist}
          onClick={onToggleWatchlist}
          icon={<BookmarkMark filled={inWatchlist} />}
        />
      </div>

      <div
        className="flex flex-col items-center gap-2 border-b py-3"
        style={{ borderColor: "var(--edge)" }}
      >
        <span className="section-label">
          {status?.rating ? "Your rating" : "Rate it"}
        </span>
        <StarRating
          id="film-rating"
          value={status?.rating ?? 0}
          onChange={onRate}
          size="lg"
        />
      </div>

      {/*
        Desktop only. Below `lg` the film page pins this same action to the
        bottom of the viewport, and two identical filled buttons on one screen
        is both redundant and a second `--blood` fill — the page is allowed
        exactly one.
      */}
      <PanelButton onClick={onLog} primary className="hidden lg:flex">
        {seen ? "Log again" : "Log this film"}
      </PanelButton>
      <PanelButton onClick={onToggleWatchlist}>
        {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      </PanelButton>
      <PanelButton onClick={onShare} last>
        Share this film
      </PanelButton>
    </aside>
  );
}

function StateCell({
  label,
  active,
  onClick,
  icon,
  className = "",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`row-hover flex min-h-[68px] flex-col items-center justify-center gap-1.5 ${className}`}
      style={{
        borderColor: "var(--edge)",
        color: active ? "var(--acid)" : "var(--xerox)",
      }}
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

function PanelButton({
  onClick,
  children,
  primary = false,
  last = false,
  className = "",
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  last?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[48px] w-full items-center justify-center px-3 text-sm ${
        className || "flex"
      } ${last ? "" : "border-b"} ${primary ? "font-semibold" : "row-hover font-medium"}`}
      style={{
        borderColor: "var(--edge)",
        background: primary ? "var(--blood)" : "transparent",
        color: "var(--chalk)",
      }}
    >
      {children}
    </button>
  );
}

/* Icons — same drafting-mark geometry as components/layout/navIcons.tsx. */

function EyeIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M2 11s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="11"
        cy="11"
        r="2.6"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function StarMark({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path
        d="M11 2.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkMark({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path
        d="M5.5 3h11v16l-5.5-4-5.5 4z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
