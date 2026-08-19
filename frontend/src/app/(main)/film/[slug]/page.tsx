"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { diaryKeys } from "@/lib/api/diary";
import { filmKeys, filmsApi, tmdbIdFromSlug } from "@/lib/api/films";
import { libraryKeys } from "@/lib/api/library";
import { reviewKeys } from "@/lib/api/reviews";
import StarRating from "@/components/ratings/StarRating";
import LogPanel from "@/components/log/LogPanel";
import ViewingHistory from "@/components/film/ViewingHistory";
import ShareFilmSheet from "@/components/film/ShareFilmSheet";
import SimilarFilms from "@/components/discover/SimilarFilms";
import CommunityReviews from "@/components/film/CommunityReviews";

/**
 * The film page.
 *
 * One rule drives the whole layout: **Log this film** is the primary action
 * (KASET.md §8). Everything else — watchlist, rating, cast, history — arranges
 * itself around that button, and nothing competes with it visually.
 */
export default function FilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const tmdbId = tmdbIdFromSlug(slug);
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { data: film, isLoading } = useQuery({
    queryKey: filmKeys.detail(tmdbId),
    queryFn: () => filmsApi.detail(tmdbId),
    enabled: Number.isFinite(tmdbId),
  });

  const { data: status } = useQuery({
    queryKey: filmKeys.status(tmdbId),
    queryFn: () => filmsApi.status(tmdbId),
    enabled: Number.isFinite(tmdbId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: filmKeys.status(tmdbId) });
    queryClient.invalidateQueries({ queryKey: filmKeys.viewings(tmdbId) });
  };

  /**
   * Everything a log touches. Wider than `refresh()` because logging writes far
   * beyond this page: the diary gains a row, a review may have been written,
   * the rating snapshot lands, and `diary_service` drops the film from the
   * watchlist server-side. Invalidating only this page's two keys left Home,
   * the Library and Community reviews serving stale data until a reload.
   */
  const refreshAfterLog = () => {
    refresh();
    queryClient.invalidateQueries({ queryKey: diaryKeys.all() });
    queryClient.invalidateQueries({ queryKey: libraryKeys.watchlist() });
    queryClient.invalidateQueries({ queryKey: libraryKeys.ratings() });
    queryClient.invalidateQueries({ queryKey: libraryKeys.reviews() });
    if (status?.filmId) {
      queryClient.invalidateQueries({ queryKey: reviewKeys.forFilm(status.filmId) });
    }
  };

  const rate = async (value: number) => {
    await filmsApi.rate(tmdbId, value);
    refresh();
  };

  const toggleWatchlist = async () => {
    if (status?.inWatchlist) await filmsApi.removeFromWatchlist(tmdbId);
    else await filmsApi.addToWatchlist(tmdbId);
    refresh();
  };

  if (!Number.isFinite(tmdbId)) return <Message>That film link looks wrong.</Message>;
  if (isLoading) return <Message>Loading…</Message>;
  if (!film) return <Message>We couldn&apos;t find that film.</Message>;

  const runtime = film.runtime ? `${film.runtime} min` : null;
  const meta = [film.year, runtime, film.genres.slice(0, 3).join(", ")].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5 lg:px-8">
      <article>
        <div className="flex gap-4">
          <Image
            src={tmdbImage(film.posterPath, "w500")}
            alt={film.title}
            width={140}
            height={210}
            className="poster h-auto w-[104px] shrink-0 object-cover sm:w-[140px]"
            priority
            unoptimized
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {film.title}
            </h1>
            <p className="meta mt-1.5">{meta.join(" · ")}</p>

            {film.directors.length > 0 && (
              <p className="mt-2 text-sm" style={{ color: "var(--xerox)" }}>
                Directed by{" "}
                {film.directors.map((d, i) => (
                  <span key={d.tmdbId}>
                    {i > 0 && ", "}
                    <Link href={`/person/${d.tmdbId}`} className="prose-link">
                      {d.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}

            {status && status.logCount > 0 && (
              <p className="meta mt-3" style={{ color: "var(--acid)" }}>
                Logged {status.logCount === 1 ? "once" : `${status.logCount} times`}
              </p>
            )}
          </div>
        </div>

        {/*
          The primary action, and the logging surface itself — they occupy the
          same slot because they are the same thing in two states. Swapping
          rather than stacking also keeps the page to exactly one tape-filled
          control at any moment (components/ui/README.md).
        */}
        <div className="mt-5">
          <AnimatePresence mode="wait" initial={false}>
            {logOpen ? (
              <LogPanel
                key="panel"
                film={film}
                filmId={status?.filmId}
                isRewatchDefault={status?.seen ?? false}
                onClose={() => setLogOpen(false)}
                onLogged={refreshAfterLog}
              />
            ) : (
              <motion.button
                key="trigger"
                type="button"
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={() => setLogOpen(true)}
                className="min-h-[52px] w-full border text-base font-semibold"
                style={{
                  borderColor: "var(--blood)",
                  background: "var(--blood)",
                  color: "var(--chalk)",
                }}
              >
                {status?.seen ? "Log again" : "Log this film"}
              </motion.button>
            )}
          </AnimatePresence>

          <div className="mt-2 flex items-stretch gap-2">
            <button
              type="button"
              onClick={toggleWatchlist}
              aria-pressed={status?.inWatchlist ?? false}
              className="min-h-[48px] flex-1 border text-sm font-medium"
              style={{
                borderColor: status?.inWatchlist ? "var(--chalk)" : "var(--edge)",
                background: status?.inWatchlist ? "var(--chalk)" : "var(--soot)",
                color: status?.inWatchlist ? "var(--void)" : "var(--chalk)",
              }}
            >
              {status?.inWatchlist ? "On your watchlist" : "Add to watchlist"}
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="min-h-[48px] border px-4 text-sm font-medium"
              style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
            >
              Share
            </button>
          </div>
        </div>

        {/*
          Your rating — distinct from logging: an opinion, not an event.

          Hidden while the panel is open. The panel carries its own star for the
          viewing being recorded, and two rating controls a few hundred pixels
          apart, writing to different tables, is a trap. Logging with a rating
          updates this one anyway (diary_service._set_current_rating), so it
          would only be a laggy duplicate of the star directly above it.
        */}
        {!logOpen && (
          <section
            className="mt-5 flex items-center justify-between border-y-2 py-3"
            style={{ borderColor: "var(--edge)" }}
          >
            <span className="section-label">Your rating</span>
            <StarRating value={status?.rating ?? 0} onChange={rate} size="lg" />
          </section>
        )}

        {film.overview && (
          <section className="mt-5">
            <h2 className="section-label">Synopsis</h2>
            <p className="mt-1.5 text-sm leading-relaxed">{film.overview}</p>
          </section>
        )}

        <ViewingHistory tmdbId={tmdbId} />

        <CommunityReviews filmId={status?.filmId} />

        <SimilarFilms tmdbId={tmdbId} />

        {film.cast.length > 0 && (
          <section className="mt-7">
            <h2 className="section-label">Cast</h2>
            <ul className="no-scrollbar mt-2 flex gap-3 overflow-x-auto pb-1">
              {film.cast.map((c) => (
                <li key={c.tmdbId} className="w-[76px] shrink-0">
                  <Link href={`/person/${c.tmdbId}`} className="block">
                    <Image
                      src={tmdbImage(c.profilePath, "w200")}
                      alt={c.name}
                      width={76}
                      height={100}
                      className="poster h-[100px] w-full object-cover"
                      unoptimized
                    />
                    <span className="mt-1 block text-xs font-medium leading-tight">
                      {c.name}
                    </span>
                    {c.character && <span className="meta block">{c.character}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {shareOpen && (
        <ShareFilmSheet film={film} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm" style={{ color: "var(--xerox)" }}>
        {children}
      </p>
    </div>
  );
}
