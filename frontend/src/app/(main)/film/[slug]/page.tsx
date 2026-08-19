"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { diaryKeys } from "@/lib/api/diary";
import { filmKeys, filmsApi, tmdbIdFromSlug } from "@/lib/api/films";
import { libraryKeys } from "@/lib/api/library";
import { reviewKeys } from "@/lib/api/reviews";
import { useLogStore } from "@/stores/logStore";
import Page from "@/components/layout/Page";
import FilmActionPanel from "@/components/film/FilmActionPanel";
import FriendsWatched from "@/components/film/FriendsWatched";
import ViewingHistory from "@/components/film/ViewingHistory";
import ShareFilmSheet from "@/components/film/ShareFilmSheet";
import SimilarFilms from "@/components/discover/SimilarFilms";
import CommunityReviews from "@/components/film/CommunityReviews";

/**
 * The film page.
 *
 * Three columns on desktop: the poster, the writing, and everything you can do
 * about it. Actions used to run down the middle of the page, which meant the
 * synopsis began below a stack of controls and the cast was four screens from
 * the top. Moving them into a fixed column gives the content one uninterrupted
 * read and keeps every action at a known place on the page.
 *
 * Below `lg` the three collapse to one, and the primary action pins itself to
 * the bottom of the viewport — on a phone a sidebar is just more scrolling.
 *
 * **Log this film** is still the primary action (KASET.md §8) and is still the
 * only filled control on the page.
 */
export default function FilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const tmdbId = tmdbIdFromSlug(slug);
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const openLog = useLogStore((s) => s.openLog);

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

  const rate = async (value: number) => {
    await filmsApi.rate(tmdbId, value);
    refresh();
  };

  const toggleWatchlist = async () => {
    if (status?.inWatchlist) await filmsApi.removeFromWatchlist(tmdbId);
    else await filmsApi.addToWatchlist(tmdbId);
    refresh();
  };

  /**
   * Everything a log touches — the dialog calls this on success.
   *
   * Wider than `refresh()` because logging writes far beyond this page: the
   * diary gains a row, a review may have been written, the rating snapshot
   * lands, and `diary_service` drops the film from the watchlist server-side.
   * Invalidating only this page's two keys left Home, the Library and Community
   * reviews serving stale data until a reload.
   */
  const refreshAfterLog = () => {
    refresh();
    queryClient.invalidateQueries({ queryKey: filmKeys.friends(tmdbId) });
    queryClient.invalidateQueries({ queryKey: diaryKeys.all() });
    queryClient.invalidateQueries({ queryKey: libraryKeys.watchlist() });
    queryClient.invalidateQueries({ queryKey: libraryKeys.ratings() });
    queryClient.invalidateQueries({ queryKey: libraryKeys.reviews() });
    if (status?.filmId) {
      queryClient.invalidateQueries({ queryKey: reviewKeys.forFilm(status.filmId) });
    }
  };

  const startLog = () => {
    if (!film) return;
    openLog({
      film,
      filmId: status?.filmId,
      isRewatch: status?.seen ?? false,
      onLogged: refreshAfterLog,
    });
  };

  if (!Number.isFinite(tmdbId)) return <Message>That film link looks wrong.</Message>;
  if (isLoading) return <Message>Loading…</Message>;
  if (!film) return <Message>We couldn&apos;t find that film.</Message>;

  const runtime = film.runtime ? `${film.runtime} min` : null;
  const meta = [film.year, runtime, film.genres.slice(0, 3).join(", ")].filter(Boolean);

  return (
    <Page className="pb-32 lg:pb-20">
      <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)_290px] lg:gap-8">
        {/* ── Poster rail ──────────────────────────────────────────────── */}
        <div className="flex gap-4 lg:block">
          <Image
            src={tmdbImage(film.posterPath, "w500")}
            alt={film.title}
            width={190}
            height={285}
            className="poster h-auto w-[112px] shrink-0 object-cover sm:w-[150px] lg:w-full"
            priority
            unoptimized
          />

          {/* On mobile the title sits beside the poster; on desktop it heads
              the centre column instead. Rendered twice, shown once. */}
          <div className="min-w-0 flex-1 lg:hidden">
            <Title film={film} meta={meta} status={status} />
          </div>
        </div>

        {/*
          ── The writing ────────────────────────────────────────────────
          `order` puts the action panel directly under the poster on mobile.
          In source order it is last, because on desktop it is the right-hand
          column; left alone that also buried "Your friends" below the cast on a
          phone, which is where the social proof is least likely to be seen.
        */}
        <article className="order-2 min-w-0 lg:order-none">
          <div className="hidden lg:block">
            <Title film={film} meta={meta} status={status} />
          </div>

          {film.overview && (
            <section className="mt-5 lg:mt-6">
              <h2 className="section-label">Synopsis</h2>
              <p className="mt-2 text-sm leading-relaxed">{film.overview}</p>
            </section>
          )}

          <ViewingHistory tmdbId={tmdbId} />

          <CommunityReviews filmId={status?.filmId} />

          <SimilarFilms tmdbId={tmdbId} />

          {film.cast.length > 0 && (
            <section className="mt-8">
              <h2 className="section-label">Cast</h2>
              <ul className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
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

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="order-1 lg:order-none lg:sticky lg:top-20 lg:self-start">
          <FilmActionPanel
            status={status}
            onLog={startLog}
            onRate={rate}
            onToggleWatchlist={toggleWatchlist}
            onShare={() => setShareOpen(true)}
          />
          <FriendsWatched tmdbId={tmdbId} />
        </div>
      </div>

      {/*
        Mobile's primary action. The panel above is reachable by scrolling, but
        the one thing you came here to do should never require that.
      */}
      <div
        className="fixed bottom-[calc(58px+env(safe-area-inset-bottom))] left-0 right-0 z-30 border-t p-3 lg:hidden"
        style={{ borderColor: "var(--edge)", background: "var(--void)" }}
      >
        <button
          type="button"
          onClick={startLog}
          className="min-h-[52px] w-full border text-base font-semibold"
          style={{
            borderColor: "var(--blood)",
            background: "var(--blood)",
            color: "var(--chalk)",
          }}
        >
          {status?.seen ? "Log again" : "Log this film"}
        </button>
      </div>

      {shareOpen && <ShareFilmSheet film={film} onClose={() => setShareOpen(false)} />}
    </Page>
  );
}

function Title({
  film,
  meta,
  status,
}: {
  film: { title: string; directors: { tmdbId: number; name: string }[] };
  meta: (string | null)[];
  status: { logCount: number } | undefined;
}) {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{film.title}</h1>
      <p className="meta mt-2">{meta.join(" · ")}</p>

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
    </>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <p className="text-sm" style={{ color: "var(--xerox)" }}>
        {children}
      </p>
    </Page>
  );
}
