"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import TasteDriftBanner from "@/components/taste/TasteDriftBanner";
import HeroFan, { type HeroData } from "@/components/feed/HeroFan";
import FeedScopeTabs, {
  type FeedScope,
} from "@/components/feed/FeedScopeTabs";
import AmbientBackdrop from "@/components/ui/AmbientBackdrop";
import ActivityFeed from "@/components/social/ActivityFeed";
import MovieSearchBar from "@/components/feed/MovieSearchBar";
import BrowseGrid from "@/components/feed/BrowseGrid";
import ForYouGrid from "@/components/feed/ForYouGrid";
import MoviesLikeSection from "@/components/discover/MoviesLikeSection";
import DiscoverRows from "@/components/discover/DiscoverRows";
import JumpBackInRow from "@/components/feed/rows/JumpBackInRow";
import ContinueSlatesRow from "@/components/feed/rows/ContinueSlatesRow";
import TrendingNearYouRow from "@/components/feed/rows/TrendingNearYouRow";
import NewUserPrompt from "@/components/feed/NewUserPrompt";
import type { ActivityEvent } from "@/types/social";

interface TwinNowItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  watchedBy: { username: string; name: string; avatarUrl: string | null };
  watchedAt: string;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuthStore();
  const [scope, setScope] = useState<FeedScope>("network");

  const heroQuery = useQuery<HeroData>({
    queryKey: ["hero-feed"],
    queryFn: () => apiFetch("/api/feed/hero"),
    enabled: !!user,
    // Advancing the hero is an explicit invalidate; don't reshuffle the pick
    // just because the tab regained focus.
    refetchOnWindowFocus: false,
  });

  const activityQuery = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity-feed", scope],
    queryFn: () => apiFetch(`/api/activity/feed?scope=${scope}`),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const twinsQuery = useQuery<{ items: TwinNowItem[] }>({
    queryKey: ["twins-now"],
    queryFn: () => apiFetch("/api/feed/twins-now"),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 60_000,
  });

  // Cold-start gate: below this many ratings the taste engine can't
  // personalise, so we surface the "rate a few films" prompt.
  const ratingsQuery = useQuery<unknown[]>({
    queryKey: ["me-ratings-count"],
    queryFn: () => apiFetch("/api/users/me/ratings"),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const isColdStart =
    ratingsQuery.isSuccess && (ratingsQuery.data?.length ?? 0) < 5;

  const heroPosterSrc = heroQuery.data?.hero?.posterPath
    ? tmdbImage(heroQuery.data.hero.posterPath, "w500")
    : null;

  if (!user && !authLoading) {
    // Anonymous landing — fall back to a simple trending grid.
    return <AnonymousHome />;
  }

  return (
    <>
      <AmbientBackdrop posterSrc={heroPosterSrc} intensity={0.4} />

      <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-24">
        {/* Always-on search */}
        <div className="mb-5">
          <MovieSearchBar />
        </div>

        {/* Jump back in — in-progress titles lead for returning users
            (self-hides when nothing is in progress). */}
        <div className="mb-8 space-y-8">
          <JumpBackInRow />
          <ContinueSlatesRow />
        </div>

        {/* Cold-start prompt — shown until the user has rated enough films. */}
        {isColdStart && (
          <div className="mb-8">
            <NewUserPrompt />
          </div>
        )}

        {/* Show me something like ___ — the essence engine, the reason to browse. */}
        <div className="mb-8">
          <MoviesLikeSection />
        </div>

        {user && <TasteDriftBanner />}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <div>
            {heroQuery.isLoading ? (
              <div
                className="h-[520px] rounded-2xl animate-pulse"
                style={{ background: "var(--bg-card)" }}
              />
            ) : heroQuery.data && heroQuery.data.hero ? (
              // Remount on each refetch so the card always mounts fresh — it
              // can never wedge on a leftover exit transform if the pick
              // repeats.
              <HeroFan key={heroQuery.dataUpdatedAt} data={heroQuery.data} />
            ) : heroQuery.data ? (
              <HeroEmpty />
            ) : null}

            {/* From your orbit — what people you follow are rating and
                watching. Sits above the personalised feed so social signal
                leads the page. */}
            <div className="mt-8 flex items-center justify-between">
              <FeedScopeTabs value={scope} onChange={setScope} />
              <Link
                href="/for-you"
                className="text-xs font-medium hover:opacity-80"
                style={{ color: "var(--cta-primary)" }}
              >
                Open For You →
              </Link>
            </div>

            <div className="mt-4">
              <h2 className="display mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                From your orbit
                <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-faint)" }}>
                  ratings &amp; activity
                </span>
              </h2>
              {activityQuery.isLoading ? (
                <p
                  className="text-sm py-12 text-center"
                  style={{ color: "var(--text-faint)" }}
                >
                  Loading…
                </p>
              ) : (
                <ActivityFeed
                  events={activityQuery.data?.events ?? []}
                  emptyText={emptyTextFor(scope)}
                />
              )}
            </div>

            {/* Personalised feed — taste engine picks for this user.
                Renders nothing if the engine returns empty, so BrowseGrid
                below always acts as a fallback. */}
            <div className="mt-8">
              <ForYouGrid />
            </div>

            {/* Always-on browseable catalog — clicks land on /film/{tmdbId}
                where ratings, reviews, slates, and discussion live. */}
            <div className="mt-2">
              <BrowseGrid />
            </div>

            {/* Browse rows absorbed from Discover — theatres/OTT + hidden gems. */}
            <DiscoverRows />

            {/* Trending near you — full ranked row (promoted from sidebar). */}
            <div className="mt-8">
              <TrendingNearYouRow />
            </div>
          </div>

          <aside className="hidden lg:block space-y-6">
            <SidebarModule
              title="Your twins right now"
              empty="Quiet for the moment."
            >
              {twinsQuery.data?.items.slice(0, 4).map((it) => (
                <Link
                  key={it.tmdbId + it.watchedBy.username}
                  href={`/film/${it.tmdbId}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:opacity-90"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  {it.posterPath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={tmdbImage(it.posterPath, "w200")}
                      alt={it.title}
                      className="w-9 h-12 rounded object-cover"
                    />
                  ) : (
                    <div
                      className="w-9 h-12 rounded"
                      style={{ background: "var(--bg-card)" }}
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {it.title}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {it.watchedBy.name}
                    </p>
                  </div>
                </Link>
              ))}
            </SidebarModule>
          </aside>
        </div>
      </div>
    </>
  );
}

function HeroEmpty() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center rounded-2xl px-6 py-16"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p
        className="display text-xl font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        You&apos;re all caught up
      </p>
      <p className="mt-2 text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
        No fresh picks right now. Rate a few more films to keep the taste engine
        learning.
      </p>
      <Link
        href="/search"
        className="mt-5 text-sm font-medium hover:opacity-80"
        style={{ color: "var(--cta-primary)" }}
      >
        Explore the catalog →
      </Link>
    </div>
  );
}

function SidebarModule({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const isEmpty =
    !children ||
    (Array.isArray(children) && children.filter(Boolean).length === 0);
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <h3
        className="display text-sm font-semibold mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <div className="space-y-2">
        {isEmpty ? (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function emptyTextFor(scope: FeedScope): string {
  switch (scope) {
    case "network":
      return "Follow people to see what they're watching.";
    case "artists":
      return "Follow artists to see their activity here.";
    case "world":
      return "The world is quiet. Check back soon.";
    default:
      return "Nothing here yet.";
  }
}

function AnonymousHome() {
  const { data } = useQuery<{ results: { id: number; title: string; poster_path: string | null }[] }>({
    queryKey: ["trending"],
    queryFn: () => apiFetch("/api/movies/trending"),
  });
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-24">
      <h1
        className="display text-2xl font-bold tracking-tight mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        Trending Now
      </h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {data?.results.map((m) => (
          <Link
            key={m.id}
            href={`/film/${m.id}`}
            className="group flex flex-col gap-2"
          >
            <div
              className="relative aspect-[2/3] overflow-hidden rounded-lg"
              style={{ background: "var(--bg-elevated)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tmdbImage(m.poster_path, "w300")}
                alt={m.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <h3
              className="truncate text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {m.title}
            </h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
