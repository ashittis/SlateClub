"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { Movie } from "@/types/movie";
import type { PublicProfile } from "@/types/user";
import Button from "@/components/ui/Button";
import StarRating from "@/components/ratings/StarRating";
import TasteIdentityCard from "@/components/taste/TasteIdentityCard";
import TribeLabel from "@/components/taste/TribeLabel";
import Link from "next/link";

/* ---------- Tab types ---------- */

type Tab = "watchlist" | "watched" | "ratings";

interface RatedMovie extends Movie {
  userRating: number;
}

/* ---------- Inline film card ---------- */

function FilmCard({ movie }: { movie: Movie }) {
  return (
    <Link
      href={`/film/${movie.tmdbId}`}
      className="group flex flex-col gap-2"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-glass-8">
        <img
          src={tmdbImage(movie.posterPath, "w300")}
          alt={movie.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="space-y-0.5 px-0.5">
        <h3 className="truncate text-sm font-medium text-text-primary">
          {movie.title}
        </h3>
        {movie.releaseDate && (
          <p className="text-xs text-text-subtle">
            {new Date(movie.releaseDate).getFullYear()}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ---------- Tab content components ---------- */

function WatchlistTab() {
  const { data: movies, isLoading } = useQuery<Movie[]>({
    queryKey: ["profile", "watchlist"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/watchlist"),
  });

  if (isLoading) {
    return <GridSkeleton />;
  }

  if (!movies || movies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        Your shelf is empty. Browse movies to add some!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((movie) => (
        <FilmCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}

function WatchedTab() {
  const { data: movies, isLoading } = useQuery<Movie[]>({
    queryKey: ["profile", "watched"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/watched"),
  });

  if (isLoading) {
    return <GridSkeleton />;
  }

  if (!movies || movies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        No watched movies yet. Start watching and logging!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((movie) => (
        <FilmCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}

function RatingsTab() {
  const { data: movies, isLoading } = useQuery<RatedMovie[]>({
    queryKey: ["profile", "ratings"],
    queryFn: () => apiFetch<RatedMovie[]>("/api/users/me/ratings"),
  });

  if (isLoading) {
    return <GridSkeleton />;
  }

  if (!movies || movies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        No ratings yet. Rate movies to build your taste profile!
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
        Your ratings — films you&apos;ve rated, newest first.
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {movies.map((movie) => (
          <Link key={movie.id} href={`/film/${movie.tmdbId}`} className="group block">
            <div
              className="aspect-[2/3] overflow-hidden rounded-lg"
              style={{ background: "var(--bg-elevated)" }}
            >
              {movie.posterPath && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(movie.posterPath, "w300")}
                  alt={movie.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              )}
            </div>
            {/* Stars you gave — under the poster */}
            {movie.userRating != null && (
              <div className="mt-1.5">
                <StarRating value={movie.userRating} readonly size="sm" />
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-lg bg-glass-8" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-glass-8" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Profile page ---------- */

const TABS: { key: Tab; label: string }[] = [
  { key: "watchlist", label: "Shelf" },
  { key: "watched", label: "Watched" },
  { key: "ratings", label: "Ratings" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("watchlist");

  // Fetch profile stats
  const { data: profile } = useQuery<PublicProfile>({
    queryKey: ["profile", "me"],
    queryFn: () => apiFetch<PublicProfile>("/api/users/me/profile"),
    enabled: !!user,
  });

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 animate-pulse rounded-full bg-glass-8" />
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-glass-8" />
            <div className="h-3 w-20 animate-pulse rounded bg-glass-8" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <p className="text-glass-40 mb-4">Please log in to view your profile.</p>
        <Link
          href="/login"
          className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-green/90 transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  const stats = profile
    ? {
        watchlist: profile.watchlist_count,
        watchHistory: profile.watched_count,
        ratings: profile.ratings_count,
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      {/* Profile header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-glass-8 text-xl font-bold text-glass-55">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              user.name[0]?.toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{user.name}</h1>
            <p className="text-sm text-text-subtle">@{user.username}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4 rounded-xl bg-glass-6 p-4">
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats.watchlist}</p>
            <p className="text-xs text-text-subtle">Shelf</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">
              {stats.watchHistory}
            </p>
            <p className="text-xs text-text-subtle">Watched</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats.ratings}</p>
            <p className="text-xs text-text-subtle">Ratings</p>
          </div>
        </div>
      )}

      {/* Bio */}
      {user.bio && (
        <p className="mb-6 text-sm text-glass-40">{user.bio}</p>
      )}

      {/* Tribe Badge */}
      <div className="mb-4">
        <TribeLabel />
      </div>

      {/* Taste Identity */}
      <div className="mb-6">
        <TasteIdentityCard />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b border-glass-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-accent-green"
                : "text-text-subtle hover:text-glass-55",
            ].join(" ")}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="profileTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-8">
        {activeTab === "watchlist" && <WatchlistTab />}
        {activeTab === "watched" && <WatchedTab />}
        {activeTab === "ratings" && <RatingsTab />}
      </div>
    </div>
  );
}
