"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { tmdbImage } from "@/lib/api/client";
import { diaryApi, diaryKeys, describeVenue, formatViewingDate } from "@/lib/api/diary";
import { activityApi, activityKeys } from "@/lib/api/activity";
import { filmHref, filmKeys, filmsApi } from "@/lib/api/films";
import { libraryApi, libraryKeys } from "@/lib/api/library";
import { searchApi, searchKeys } from "@/lib/api/search";
import Page, { Section } from "@/components/layout/Page";
import StarRating from "@/components/ratings/StarRating";
import FilmCard, { type FilmCardFilm } from "@/components/film/FilmCard";
import FriendActivityCard from "@/components/social/FriendActivityCard";
import { useQuickActions } from "@/components/film/useQuickActions";

/**
 * Home.
 *
 * Kaset's rule is that **every section must earn its place** (KASET.md §8) — so
 * each one renders only when it has something to say. A new account sees a
 * greeting, a way into search, and the log action; nothing else, rather than a
 * screen of empty shelves.
 *
 * What your people watched leads. It is the only section that is different
 * every time you open the app, and it is the reason to open the app at all —
 * your own diary and watchlist are not news to you. Everything below it is
 * ordered by how likely it is to send you somewhere: your list, then ours.
 */
export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { open: openQuickActions, sheet } = useQuickActions();
  const firstName = user?.name?.split(" ")[0];

  const { data: diary } = useQuery({
    queryKey: diaryKeys.year(),
    queryFn: () => diaryApi.list(),
  });

  const { data: activity } = useQuery({
    queryKey: activityKeys.feed("network"),
    queryFn: () => activityApi.feed("network", 18),
  });

  const { data: watchlist } = useQuery({
    queryKey: libraryKeys.watchlist(),
    queryFn: () => libraryApi.watchlist(),
  });

  const { data: amongFollowing } = useQuery({
    queryKey: searchKeys.popularAmongFollowing(),
    queryFn: () => searchApi.popularAmongFollowing(),
  });

  const { data: trending } = useQuery({
    queryKey: filmKeys.search("__home_trending"),
    queryFn: () => filmsApi.trending(),
  });

  const recent = (diary ?? []).slice(0, 6);
  const events = activity?.events ?? [];
  const upNext = (watchlist ?? []).slice(0, 12);
  const popular = amongFollowing?.results ?? [];

  return (
    <Page>
      <header className="border-b pb-5" style={{ borderColor: "var(--edge)" }}>
        <h1 className="text-2xl lg:text-[28px]">
          {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}{" "}
          <span style={{ color: "var(--xerox)" }}>
            {events.length
              ? "Here's what your friends have been watching…"
              : "Let's find something to watch…"}
          </span>
        </h1>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/search"
            className="flex min-h-[48px] items-center justify-center border px-5 text-sm font-semibold sm:flex-none"
            style={{
              borderColor: "var(--blood)",
              background: "var(--blood)",
              color: "var(--chalk)",
            }}
          >
            Find a film to log
          </Link>
          <Link
            href="/library"
            className="flex min-h-[48px] items-center justify-center border px-5 text-sm font-medium sm:flex-none"
            style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
          >
            Your Library
          </Link>
          <p className="meta flex items-center sm:ml-2">
            {recent.length
              ? `${diary!.length} ${diary!.length === 1 ? "viewing" : "viewings"} logged`
              : "Log a film to start your diary"}
          </p>
        </div>
      </header>

      {/* What your people are doing — the reason to come back. */}
      {events.length > 0 && (
        <Section title="New from friends" href="/activity" linkLabel="all activity">
          <ul className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
            {events.map((e) => (
              <li key={e.id} className="shrink-0">
                <FriendActivityCard event={e} onQuickActions={openQuickActions} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {popular.length > 0 && (
        <Section title="Popular with friends" href="/search" linkLabel="more">
          <PosterRail films={popular.slice(0, 12)} onQuickActions={openQuickActions} />
        </Section>
      )}

      {/* What to watch next — your own list first, then something new. */}
      {upNext.length > 0 && (
        <Section title="Up next on your watchlist" href="/library">
          <PosterRail films={upNext} saved onQuickActions={openQuickActions} />
        </Section>
      )}

      {(trending?.results.length ?? 0) > 0 && (
        <Section title="Trending this week" href="/search">
          <PosterRail
            films={trending!.results.slice(0, 12)}
            onQuickActions={openQuickActions}
          />
        </Section>
      )}

      {/* What you were doing. Last, because it is the least surprising. */}
      {recent.length > 0 && (
        <Section title="Your recent viewings" href="/library">
          <ul className="border-t" style={{ borderColor: "var(--edge)" }}>
            {recent.map((e) => (
              <li
                key={e.entryId}
                className="row-hover flex items-center gap-3 border-b px-2 py-2.5"
                style={{ borderColor: "var(--edge)" }}
              >
                <Link href={filmHref(e)} className="shrink-0">
                  <Image
                    src={tmdbImage(e.posterPath, "w200")}
                    alt=""
                    width={32}
                    height={48}
                    className="poster object-cover"
                    unoptimized
                  />
                </Link>
                <Link href={filmHref(e)} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.title}</span>
                  <span className="meta block">
                    {formatViewingDate(e.watchedOn)} · {describeVenue(e)}
                  </span>
                </Link>
                {e.rating ? <StarRating value={e.rating} readonly size="sm" /> : null}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sheet}
    </Page>
  );
}

function PosterRail({
  films,
  saved = false,
  onQuickActions,
}: {
  films: { tmdbId: number; title: string; posterPath: string | null; year: string | null }[];
  /** These already live on the watchlist, so the bookmark starts filled. */
  saved?: boolean;
  onQuickActions?: (f: FilmCardFilm) => void;
}) {
  return (
    <ul className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
      {films.map((f) => (
        <li key={f.tmdbId} className="shrink-0">
          <FilmCard film={f} width={116} saved={saved} onQuickActions={onQuickActions} />
        </li>
      ))}
    </ul>
  );
}
