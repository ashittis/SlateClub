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
import { shelfReasonSummary, dnfReasonLabel } from "@/lib/shelfReasons";
import { titleHref } from "@/lib/titleHref";
import MediaFilter, {
  filterByMedia,
  type MediaFilterValue,
} from "@/components/profile/MediaFilter";
import SlateCard from "@/components/slates/SlateCard";
import type { SlateCard as SlateCardType } from "@/types/slates";
import Link from "next/link";

/* ---------- Tab types ---------- */

type Tab = "watchlist" | "watching" | "dnf" | "watched" | "ratings" | "slates";

interface RatedMovie extends Movie {
  userRating: number;
}
interface ShelfMovie extends Movie {
  reasonType: string | null;
  reasonReference: string | null;
  note: string | null;
  addedAt: string;
}
interface DnfMovie extends Movie {
  reason: string | null;
  stoppedAt: string | null;
  progressPct: number | null;
}
interface WatchingMovie extends Movie {
  progressPct: number;
  startedAt: string;
}

/* Rough "3 weeks ago" relative time — good enough for shelf provenance. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} week${w > 1 ? "s" : ""} ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} month${m > 1 ? "s" : ""} ago`;
  }
  const y = Math.floor(days / 365);
  return `${y} year${y > 1 ? "s" : ""} ago`;
}

/* ---------- Inline film card ---------- */

function PosterLink({ movie, children }: { movie: Movie; children?: React.ReactNode }) {
  return (
    <Link href={titleHref(movie.tmdbId, movie.mediaType)} className="group flex flex-col gap-2">
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
        {children}
      </div>
    </Link>
  );
}

function FilmCard({ movie }: { movie: Movie }) {
  return (
    <PosterLink movie={movie}>
      {movie.releaseDate && (
        <p className="text-xs text-text-subtle">
          {new Date(movie.releaseDate).getFullYear()}
        </p>
      )}
    </PosterLink>
  );
}

/* Shelf card — reads like a journal entry: the italic note leads, then the
   provenance ("Reminds you of X") and "Added <time ago>" beneath. */
function ShelfCard({ movie }: { movie: ShelfMovie }) {
  const because = shelfReasonSummary(movie.reasonType, movie.reasonReference);
  return (
    <PosterLink movie={movie}>
      {movie.note && (
        <p
          className="text-xs italic leading-snug line-clamp-2"
          style={{ color: "var(--text-muted)" }}
        >
          “{movie.note}”
        </p>
      )}
      {because && (
        <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
          {because}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        Added {timeAgo(movie.addedAt)}
      </p>
    </PosterLink>
  );
}

/* ---------- Tab content components ---------- */

function WatchlistTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<ShelfMovie[]>({
    queryKey: ["profile", "watchlist"],
    queryFn: () => apiFetch<ShelfMovie[]>("/api/users/me/watchlist"),
  });

  if (isLoading) {
    return <GridSkeleton />;
  }

  const movies = filterByMedia(data ?? [], media);
  if (movies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        Your shelf is empty. Browse titles to add some!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((movie) => (
        <ShelfCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}

function WatchingTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<WatchingMovie[]>({
    queryKey: ["profile", "watching"],
    queryFn: () => apiFetch<WatchingMovie[]>("/api/users/me/watching"),
  });

  if (isLoading) return <GridSkeleton />;

  const movies = filterByMedia(data ?? [], media);
  if (movies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        Nothing in progress.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((movie) => (
        <PosterLink key={movie.id} movie={movie}>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Started {timeAgo(movie.startedAt)}
          </p>
        </PosterLink>
      ))}
    </div>
  );
}

function DnfTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<DnfMovie[]>({
    queryKey: ["profile", "dnf"],
    queryFn: () => apiFetch<DnfMovie[]>("/api/users/me/dnf"),
  });

  if (isLoading) return <GridSkeleton />;

  const movies = filterByMedia(data ?? [], media);
  if (movies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        No abandoned titles — yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((movie) => {
        const label = dnfReasonLabel(movie.reason);
        return (
          <PosterLink key={movie.id} movie={movie}>
            {label && (
              <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                {label}
              </p>
            )}
          </PosterLink>
        );
      })}
    </div>
  );
}

function WatchedTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<Movie[]>({
    queryKey: ["profile", "watched"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/watched"),
  });

  if (isLoading) {
    return <GridSkeleton />;
  }

  const movies = filterByMedia(data ?? [], media);
  if (movies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        Nothing watched yet. Start watching and logging!
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

function RatingsTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<RatedMovie[]>({
    queryKey: ["profile", "ratings"],
    queryFn: () => apiFetch<RatedMovie[]>("/api/users/me/ratings"),
  });

  if (isLoading) {
    return <GridSkeleton />;
  }

  const all = data ?? [];
  const movies = filterByMedia(all, media);
  if (all.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        No ratings yet. Rate titles to build your taste profile!
      </p>
    );
  }

  const movieCount = all.filter((m) => (m.mediaType ?? "movie") === "movie").length;
  const seriesCount = all.filter((m) => m.mediaType === "tv").length;

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
        Movies ★ {movieCount} · Series ★ {seriesCount}
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {movies.map((movie) => (
          <Link key={movie.id} href={titleHref(movie.tmdbId, movie.mediaType)} className="group block">
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

function SlatesTab() {
  const mine = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates", "mine"],
    queryFn: () => apiFetch("/api/slates/mine"),
  });
  const saved = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates", "saved"],
    queryFn: () => apiFetch("/api/slates/saved"),
  });
  const collab = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates", "collaborative"],
    queryFn: () => apiFetch("/api/slates/collaborative"),
  });

  if (mine.isLoading) return <GridSkeleton />;

  const sections: { label: string; items: SlateCardType[] }[] = [
    { label: "Created", items: mine.data?.items ?? [] },
    { label: "Collaborative", items: collab.data?.items ?? [] },
    { label: "Saved", items: saved.data?.items ?? [] },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-subtle">
        No slates yet. Create one from the Slates tab.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((sec) => (
        <div key={sec.label}>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            {sec.label}
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {sec.items.map((s) => (
              <SlateCard key={s.id} slate={s} />
            ))}
          </div>
        </div>
      ))}
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("watchlist");
  const [media, setMedia] = useState<MediaFilterValue>("all");

  // Fetch profile stats
  const { data: profile } = useQuery<PublicProfile>({
    queryKey: ["profile", "me"],
    queryFn: () => apiFetch<PublicProfile>("/api/users/me/profile"),
    enabled: !!user,
  });

  // Count for the DNF tab label (shared cache with the tab).
  const { data: dnfList } = useQuery<Movie[]>({
    queryKey: ["profile", "dnf"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/dnf"),
    enabled: !!user,
  });

  // Currently Watching is series-only — its tab only appears when non-empty.
  const { data: watchingList } = useQuery<Movie[]>({
    queryKey: ["profile", "watching"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/watching"),
    enabled: !!user,
  });

  const { data: slatesList } = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates", "mine"],
    queryFn: () => apiFetch("/api/slates/mine"),
    enabled: !!user,
  });

  const tabOrder: { key: Tab; label: string }[] = [
    { key: "watchlist", label: "Shelf" },
    ...((watchingList?.length ?? 0) > 0
      ? [{ key: "watching" as Tab, label: "Watching" }]
      : []),
    { key: "dnf", label: "DNF" },
    { key: "watched", label: "Watched" },
    { key: "ratings", label: "Ratings" },
    { key: "slates", label: "Slates" },
  ];

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
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-glass-6 no-scrollbar">
        {tabOrder.map((tab) => {
          const count =
            tab.key === "watchlist"
              ? profile?.watchlist_count
              : tab.key === "watching"
                ? watchingList?.length
                : tab.key === "dnf"
                  ? dnfList?.length
                  : tab.key === "watched"
                    ? profile?.watched_count
                    : tab.key === "slates"
                      ? slatesList?.items.length
                      : profile?.ratings_count;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "text-accent-green"
                  : "text-text-subtle hover:text-glass-55",
              ].join(" ")}
            >
              {tab.label}
              {count != null && count > 0 ? ` (${count})` : ""}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="profileTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* All · Movies · Series sub-filter (not for Slates) */}
      {activeTab !== "slates" && (
        <div className="mb-4">
          <MediaFilter value={media} onChange={setMedia} layoutId="profile-media" />
        </div>
      )}

      {/* Tab content */}
      <div className="pb-8">
        {activeTab === "watchlist" && <WatchlistTab media={media} />}
        {activeTab === "watching" && <WatchingTab media={media} />}
        {activeTab === "dnf" && <DnfTab media={media} />}
        {activeTab === "watched" && <WatchedTab media={media} />}
        {activeTab === "ratings" && <RatingsTab media={media} />}
        {activeTab === "slates" && <SlatesTab />}
      </div>
    </div>
  );
}
