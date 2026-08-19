"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { filmHref, filmsApi, filmKeys } from "@/lib/api/films";
import { libraryKeys } from "@/lib/api/library";

/**
 * The poster card — the one film card the whole app uses.
 *
 * Two of the flow changes live here, because a card is where people actually
 * meet a film:
 *
 *   Bookmark      one tap to the watchlist, from anywhere a poster appears.
 *                 Previously that took four: card → film page → scroll → button.
 *   Quick actions long-press for rate / log / share without leaving the page.
 *
 * Long-press is a shortcut, never the only route — it's invisible to anyone who
 * doesn't already know it's there. So the card also carries a visible `⋯`, and
 * everything behind it stays reachable on the film page.
 *
 * Posters keep their true colour. They are the content; duotone is for
 * editorial imagery (see components/texture/Duotone.tsx).
 */

const LONG_PRESS_MS = 450;

export interface FilmCardFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year?: string | null;
}

export default function FilmCard({
  film,
  width = 96,
  saved = false,
  onQuickActions,
  priority = false,
  caption,
  footer,
}: {
  film: FilmCardFilm;
  /** Rendered poster width in px; height follows the 2:3 poster ratio. */
  width?: number;
  /** Whether this film is already on the watchlist. */
  saved?: boolean;
  /** Opens the quick-actions sheet. Omit to disable long-press entirely. */
  onQuickActions?: (film: FilmCardFilm) => void;
  priority?: boolean;
  /**
   * Replaces the default title/year lines. Pass `null` to show the poster
   * alone — in a friend-activity row the poster *is* the identification, and
   * repeating the title under every one turns the row into a wall of text.
   */
  caption?: React.ReactNode | null;
  /**
   * Rendered flush against the poster's bottom edge, inside the card's border.
   * Built for the attribution bar on the home feed (who watched this).
   */
  footer?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [bookmarked, setBookmarked] = useState(saved);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const height = Math.round(width * 1.5);

  const toggleBookmark = async (e: React.MouseEvent) => {
    // The card is a link; the bookmark must not navigate.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !bookmarked;
    setBookmarked(next); // optimistic — the tap should feel instant
    setBusy(true);
    try {
      if (next) await filmsApi.addToWatchlist(film.tmdbId);
      else await filmsApi.removeFromWatchlist(film.tmdbId);
      queryClient.invalidateQueries({ queryKey: libraryKeys.watchlist() });
      queryClient.invalidateQueries({ queryKey: filmKeys.status(film.tmdbId) });
    } catch {
      setBookmarked(!next); // put it back rather than lie about the state
    } finally {
      setBusy(false);
    }
  };

  const startPress = () => {
    if (!onQuickActions) return;
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      // Haptic where it exists — this is a press, it should feel like one.
      navigator.vibrate?.(12);
      onQuickActions(film);
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div style={{ width }}>
      {/*
        The overlay controls anchor to THIS box, not the card, so they sit on
        the artwork itself. They used to be positioned against the outer card,
        which put the `⋯` on top of the year line rather than on the poster —
        and left no room for a footer at all.
      */}
      <div className="relative">
        <Link
          href={filmHref(film)}
          className="block"
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => {
            // Long-press raises the OS menu on touch; ours replaces it.
            if (onQuickActions) e.preventDefault();
          }}
          onClick={(e) => {
            if (longFired.current) e.preventDefault();
          }}
        >
          <Image
            src={tmdbImage(film.posterPath, "w300")}
            alt={film.title}
            width={width}
            height={height}
            className="poster w-full object-cover"
            priority={priority}
            unoptimized
          />
        </Link>

        <button
          type="button"
          onClick={toggleBookmark}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? `Remove ${film.title} from watchlist` : `Add ${film.title} to watchlist`}
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center transition-opacity"
          style={{
            background: bookmarked ? "var(--acid)" : "rgba(20,18,26,0.72)",
            color: bookmarked ? "var(--void)" : "var(--chalk)",
          }}
        >
          <BookmarkMark filled={bookmarked} />
        </button>

        {onQuickActions && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onQuickActions(film);
            }}
            aria-label={`More actions for ${film.title}`}
            className="absolute bottom-0 left-0 flex h-9 w-9 items-center justify-center"
            style={{ background: "rgba(20,18,26,0.72)", color: "var(--chalk)" }}
          >
            <span className="text-base leading-none" aria-hidden>⋯</span>
          </button>
        )}
      </div>

      {footer}

      {caption === undefined ? (
        <Link href={filmHref(film)} className="block">
          <span className="mt-1 block truncate text-xs font-medium">{film.title}</span>
          <span className="meta block">{film.year ?? "—"}</span>
        </Link>
      ) : (
        caption
      )}
    </div>
  );
}

function BookmarkMark({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden focusable="false">
      <path
        d="M2 1.5h10v13l-5-3.6-5 3.6z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
