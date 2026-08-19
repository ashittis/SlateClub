"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { tmdbImage } from "@/lib/api/client";
import { diaryApi, diaryKeys, describeVenue, formatViewingDate } from "@/lib/api/diary";
import { activityApi, activityKeys, describeActivity } from "@/lib/api/activity";
import { filmHref, filmKeys, filmsApi } from "@/lib/api/films";
import { libraryApi, libraryKeys } from "@/lib/api/library";
import StarRating from "@/components/ratings/StarRating";
import FilmCard from "@/components/film/FilmCard";
import { useQuickActions } from "@/components/film/useQuickActions";

/**
 * Home.
 *
 * SlateClub's home was an eight-section dashboard fed by the ML stack. Kaset's
 * rule is that **every section must earn its place** (KASET.md §8) — so each one
 * here renders only when it has something to say. A new account sees a greeting,
 * a way into search, and the log action; nothing else, rather than a screen of
 * empty shelves.
 *
 * Order follows the loop: what you were doing → what your people are doing →
 * what to watch next.
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
    queryFn: () => activityApi.feed("network", 8),
  });

  const { data: watchlist } = useQuery({
    queryKey: libraryKeys.watchlist(),
    queryFn: () => libraryApi.watchlist(),
  });

  const { data: trending } = useQuery({
    queryKey: filmKeys.search("__home_trending"),
    queryFn: () => filmsApi.trending(),
  });

  const recent = (diary ?? []).slice(0, 6);
  const events = activity?.events ?? [];
  const upNext = (watchlist ?? []).slice(0, 8);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="meta mt-1">
          {recent.length
            ? `${diary!.length} ${diary!.length === 1 ? "viewing" : "viewings"} logged`
            : "Log a film to start your diary"}
        </p>
      </header>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/search"
          className="flex min-h-[48px] flex-1 items-center justify-center border px-4 text-sm font-semibold"
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
          className="flex min-h-[48px] items-center justify-center border px-4 text-sm font-medium"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          Your Library
        </Link>
      </div>

      {/* What you were doing. */}
      {recent.length > 0 && (
        <Section title="Your recent viewings" href="/library">
          <ul className="border-t-2" style={{ borderColor: "var(--edge)" }}>
            {recent.map((e) => (
              <li
                key={e.entryId}
                className="flex items-center gap-3 border-b-2 py-2"
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

      {/* What your people are doing. */}
      {events.length > 0 && (
        <Section title="From people you follow" href="/activity">
          <ul className="border-t-2" style={{ borderColor: "var(--edge)" }}>
            {events.slice(0, 6).map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 border-b-2 py-2 text-sm"
                style={{ borderColor: "var(--edge)" }}
              >
                <Link
                  href={`/passport/${e.user.username}`}
                  className="shrink-0 font-medium"
                >
                  {e.user.name}
                </Link>
                <span className="shrink-0" style={{ color: "var(--xerox)" }}>
                  {describeActivity(e)}
                </span>
                <Link
                  href={`/film/${e.movie.tmdbId}`}
                  className="min-w-0 flex-1 truncate font-medium"
                >
                  {e.movie.title}
                </Link>
              </li>
            ))}
          </ul>
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
          <PosterRail films={trending!.results.slice(0, 12)} onQuickActions={openQuickActions} />
        </Section>
      )}

      {sheet}
    </div>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between">
        <h2 className="section-label">{title}</h2>
        <Link href={href} className="meta" style={{ color: "var(--blood-ink)" }}>
          see all
        </Link>
      </div>
      <div className="mt-2">{children}</div>
    </section>
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
  onQuickActions?: (f: { tmdbId: number; title: string; posterPath: string | null; year?: string | null }) => void;
}) {
  return (
    <ul className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
      {films.map((f) => (
        <li key={f.tmdbId} className="shrink-0">
          <FilmCard film={f} width={96} saved={saved} onQuickActions={onQuickActions} />
        </li>
      ))}
    </ul>
  );
}
