"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { filmHref, filmKeys, filmsApi } from "@/lib/api/films";
import { libraryKeys } from "@/lib/api/library";
import { diaryApi, diaryKeys, todayISO } from "@/lib/api/diary";
import { useLogStore } from "@/stores/logStore";
import StarRating from "@/components/ratings/StarRating";
import type { FilmCardFilm } from "./FilmCard";

/**
 * Quick actions — rate, log, watchlist, share, without leaving the page.
 *
 * Reached by long-pressing a poster or tapping its `⋯`. This is the shortcut
 * layer: it deliberately offers only the actions people repeat, and everything
 * else stays on the film page rather than being duplicated here.
 *
 * Logging from here records a viewing dated today with no venue — the full log
 * panel is one tap away for anything more considered.
 */
export default function QuickActions({
  film,
  onClose,
}: {
  film: FilmCardFilm;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const openLog = useLogStore((s) => s.openLog);
  const [pending, setPending] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);

  const { data: status } = useQuery({
    queryKey: filmKeys.status(film.tmdbId),
    queryFn: () => filmsApi.status(film.tmdbId),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: filmKeys.status(film.tmdbId) });
    queryClient.invalidateQueries({ queryKey: libraryKeys.watchlist() });
    queryClient.invalidateQueries({ queryKey: diaryKeys.all() });
  };

  const rate = async (value: number) => {
    setPending("rate");
    try {
      await filmsApi.rate(film.tmdbId, value);
      refresh();
    } finally {
      setPending(null);
    }
  };

  const logNow = async () => {
    if (!status?.filmId) return;
    setPending("log");
    try {
      await diaryApi.log({ movieId: status.filmId, watchedOn: todayISO() });
      setLogged(true);
      refresh();
    } finally {
      setPending(null);
    }
  };

  const toggleWatchlist = async () => {
    setPending("watchlist");
    try {
      if (status?.inWatchlist) await filmsApi.removeFromWatchlist(film.tmdbId);
      else await filmsApi.addToWatchlist(film.tmdbId);
      refresh();
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(10,9,14,0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${film.title}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full border sm:max-w-sm"
        style={{ background: "var(--soot)", borderColor: "var(--edge-hot)" }}
      >
        <header
          className="flex items-center gap-3 border-b p-3"
          style={{ borderColor: "var(--edge)" }}
        >
          <Image
            src={tmdbImage(film.posterPath, "w200")}
            alt=""
            width={40}
            height={60}
            className="poster shrink-0 object-cover"
            unoptimized
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{film.title}</p>
            <p className="meta">{film.year ?? "—"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center text-lg"
            style={{ color: "var(--xerox)" }}
          >
            ×
          </button>
        </header>

        <div className="border-b p-4" style={{ borderColor: "var(--edge)" }}>
          <p className="section-label mb-2">Rate</p>
          <StarRating
            value={status?.rating ?? 0}
            onChange={rate}
            size="lg"
          />
        </div>

        <div className="flex flex-col">
          <Row
            onClick={logNow}
            disabled={pending !== null || logged}
            label={logged ? "Logged today" : "Log as watched today"}
            hint={logged ? undefined : "Dated today, no venue"}
            done={logged}
          />
          {/*
            The considered log, without leaving the page. This used to say
            "open the film page" — a navigation, a load, and a scroll to reach
            a form that is now a dialog we can simply raise from here.
          */}
          <Row
            onClick={() => {
              onClose();
              openLog({
                film,
                filmId: status?.filmId,
                isRewatch: status?.seen ?? false,
                onLogged: refresh,
              });
            }}
            disabled={pending !== null || logged}
            label="Log with a rating, date, review…"
          />
          <Row
            onClick={toggleWatchlist}
            disabled={pending !== null}
            label={status?.inWatchlist ? "On your watchlist" : "Add to watchlist"}
            done={status?.inWatchlist}
          />
          <Link
            href={filmHref(film)}
            className="flex min-h-[52px] items-center px-4 text-sm font-medium"
            style={{ color: "var(--chalk)" }}
          >
            Open film page
            <span className="meta ml-auto" style={{ color: "var(--blood-ink)" }}>
              cast, reviews, similar
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  onClick,
  disabled,
  label,
  hint,
  done,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  hint?: string;
  done?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] items-center border-b px-4 text-left text-sm font-medium disabled:opacity-60"
      style={{ borderColor: "var(--edge)", color: done ? "var(--acid)" : "var(--chalk)" }}
    >
      {label}
      {hint && <span className="meta ml-auto">{hint}</span>}
    </button>
  );
}
