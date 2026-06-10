"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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

/* ---------- Types ---------- */

type Tab = "watchlist" | "watching" | "dnf" | "watched" | "ratings" | "slates";

interface RatedMovie extends Movie {
  userRating: number;
  ratedAt?: string | null;
}
interface WatchedMovie extends Movie {
  watchedAt?: string | null;
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
interface FavFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

/* ---------- Helpers ---------- */

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) { const w = Math.floor(days / 7); return `${w}w ago`; }
  if (days < 365) { const m = Math.floor(days / 30); return `${m}mo ago`; }
  return `${Math.floor(days / 365)}y ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------- Sub-components ---------- */

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

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <div className="w-10 h-14 animate-pulse rounded bg-glass-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-48 animate-pulse rounded bg-glass-8" />
            <div className="h-3 w-24 animate-pulse rounded bg-glass-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* List-style film row — used by Watched and Ratings tabs */
function FilmRow({
  movie,
  dateLabel,
  rating,
}: {
  movie: Movie;
  dateLabel?: string | null;
  rating?: number | null;
}) {
  return (
    <Link
      href={titleHref(movie.tmdbId, movie.mediaType)}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-glass-6 group"
    >
      <div className="w-10 shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-md" style={{ background: "var(--bg-elevated)" }}>
          {movie.posterPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tmdbImage(movie.posterPath, "w200")}
              alt={movie.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {movie.title}
        </p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          {movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : ""}
        </p>
        {rating != null && (
          <div className="mt-0.5">
            <StarRating value={rating} readonly size="sm" />
          </div>
        )}
      </div>
      {dateLabel && (
        <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
          {dateLabel}
        </span>
      )}
    </Link>
  );
}

/* PosterLink for shelf/grid views */
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
        <h3 className="truncate text-sm font-medium text-text-primary">{movie.title}</h3>
        {children}
      </div>
    </Link>
  );
}

function ShelfCard({ movie }: { movie: ShelfMovie }) {
  const because = shelfReasonSummary(movie.reasonType, movie.reasonReference);
  return (
    <PosterLink movie={movie}>
      {movie.note && (
        <p className="text-xs italic leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>
          "{movie.note}"
        </p>
      )}
      {because && <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>{because}</p>}
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>Added {timeAgo(movie.addedAt)}</p>
    </PosterLink>
  );
}

/* ---------- Onboarding Favourites strip ---------- */

function FavouritesStrip() {
  const { data, isLoading } = useQuery<FavFilm[]>({
    queryKey: ["profile", "favorites"],
    queryFn: () => apiFetch<FavFilm[]>("/api/users/me/favorites"),
  });

  if (isLoading || !data || data.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        Onboarding Picks
      </p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {data.map((f) => (
          <Link key={f.tmdbId} href={`/film/${f.tmdbId}`} className="shrink-0 group">
            <div
              className="w-16 aspect-[2/3] rounded-lg overflow-hidden"
              style={{ background: "var(--bg-elevated)", border: "1.5px solid rgba(255,255,255,0.07)" }}
            >
              {f.posterPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tmdbImage(f.posterPath, "w200")}
                  alt={f.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center p-1 text-center text-[9px]" style={{ color: "var(--text-faint)" }}>
                  {f.title}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------- Recent Activity section ---------- */

interface ActivityEvent {
  id: string;
  type: string;
  createdAt?: string;
  created_at?: string;
  metadata?: { rating?: number } | null;
  movie?: { id: string; tmdbId?: number; tmdb_id?: number; title: string; posterPath?: string; poster_path?: string };
}

function RecentActivity({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity", "user", userId],
    queryFn: () => apiFetch(`/api/activity/user/${userId}?limit=20`),
    enabled: !!userId,
  });

  const events = data?.events ?? [];
  if (isLoading) return <ListSkeleton />;
  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, 5);

  const typeLabel: Record<string, string> = {
    watched: "Watched",
    rated: "Rated",
    watchlisted: "Added to shelf",
    reviewed: "Reviewed",
  };

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        Recent Activity
      </p>
      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {visible.map((ev) => {
            const movie = ev.movie;
            const dateStr = ev.createdAt ?? ev.created_at;
            const tmdbId = movie?.tmdbId ?? movie?.tmdb_id;
            const poster = movie?.posterPath ?? movie?.poster_path;
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-glass-6"
              >
                {poster && tmdbId && (
                  <Link href={`/film/${tmdbId}`} className="shrink-0">
                    <div className="w-8 aspect-[2/3] overflow-hidden rounded" style={{ background: "var(--bg-elevated)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={tmdbImage(poster, "w200")} alt={movie?.title ?? ""} className="h-full w-full object-cover" />
                    </div>
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {movie?.title ?? "Unknown"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {typeLabel[ev.type] ?? ev.type}
                    {ev.type === "rated" && ev.metadata?.rating != null ? ` · ${ev.metadata.rating / 2}★` : ""}
                  </p>
                </div>
                {dateStr && (
                  <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
                    {timeAgo(dateStr)}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {events.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--cta-primary)" }}
        >
          {expanded ? "Show less" : `Show ${events.length - 5} more activities`}
        </button>
      )}
    </div>
  );
}

/* ---------- Tab content ---------- */

function WatchlistTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<ShelfMovie[]>({
    queryKey: ["profile", "watchlist"],
    queryFn: () => apiFetch<ShelfMovie[]>("/api/users/me/watchlist"),
  });

  if (isLoading) return <GridSkeleton />;
  const movies = filterByMedia(data ?? [], media);
  if (movies.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">Your shelf is empty. Browse titles to add some!</p>;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((m) => <ShelfCard key={m.id} movie={m} />)}
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
  if (movies.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">Nothing in progress.</p>;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((m) => (
        <PosterLink key={m.id} movie={m}>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Started {timeAgo(m.startedAt)}</p>
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
  if (movies.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">No abandoned titles — yet.</p>;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((m) => {
        const label = dnfReasonLabel(m.reason);
        return (
          <PosterLink key={m.id} movie={m}>
            {label && <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>{label}</p>}
          </PosterLink>
        );
      })}
    </div>
  );
}

function WatchedTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<WatchedMovie[]>({
    queryKey: ["profile", "watched"],
    queryFn: () => apiFetch<WatchedMovie[]>("/api/users/me/watched"),
  });

  if (isLoading) return <ListSkeleton />;
  const movies = filterByMedia(data ?? [], media);
  if (movies.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">Nothing watched yet. Start watching and logging!</p>;

  return (
    <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      {movies.map((m) => (
        <FilmRow
          key={m.id}
          movie={m}
          dateLabel={m.watchedAt ? formatDate(m.watchedAt) : undefined}
        />
      ))}
    </div>
  );
}

function RatingsTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<RatedMovie[]>({
    queryKey: ["profile", "ratings"],
    queryFn: () => apiFetch<RatedMovie[]>("/api/users/me/ratings"),
  });

  if (isLoading) return <ListSkeleton />;
  const all = data ?? [];
  const movies = filterByMedia(all, media);

  if (all.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">No ratings yet. Rate titles to build your taste profile!</p>;

  const movieCount = all.filter((m) => (m.mediaType ?? "movie") === "movie").length;
  const seriesCount = all.filter((m) => m.mediaType === "tv").length;

  return (
    <div>
      <p className="mb-2 text-sm" style={{ color: "var(--text-muted)" }}>
        Movies ★ {movieCount} · Series ★ {seriesCount}
      </p>
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {movies.map((m) => (
          <FilmRow
            key={m.id}
            movie={m}
            rating={m.userRating}
            dateLabel={m.ratedAt ? formatDate(m.ratedAt) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function SlatesTab() {
  const mine = useQuery<{ items: SlateCardType[] }>({ queryKey: ["slates", "mine"], queryFn: () => apiFetch("/api/slates/mine") });
  const saved = useQuery<{ items: SlateCardType[] }>({ queryKey: ["slates", "saved"], queryFn: () => apiFetch("/api/slates/saved") });
  const collab = useQuery<{ items: SlateCardType[] }>({ queryKey: ["slates", "collaborative"], queryFn: () => apiFetch("/api/slates/collaborative") });

  if (mine.isLoading) return <GridSkeleton />;

  const sections = [
    { label: "Created", items: mine.data?.items ?? [] },
    { label: "Collaborative", items: collab.data?.items ?? [] },
    { label: "Saved", items: saved.data?.items ?? [] },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">No slates yet. Create one from the Slates tab.</p>;

  return (
    <div className="space-y-8">
      {sections.map((sec) => (
        <div key={sec.label}>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{sec.label}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {sec.items.map((s) => <SlateCard key={s.id} slate={s} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Profile page ---------- */

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("watched");
  const [media, setMedia] = useState<MediaFilterValue>("all");

  const { data: profile } = useQuery<PublicProfile>({
    queryKey: ["profile", "me"],
    queryFn: () => apiFetch<PublicProfile>("/api/users/me/profile"),
    enabled: !!user,
  });

  const { data: dnfList } = useQuery<Movie[]>({
    queryKey: ["profile", "dnf"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/dnf"),
    enabled: !!user,
  });

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
    { key: "watched", label: "Watched" },
    { key: "ratings", label: "Ratings" },
    { key: "watchlist", label: "Shelf" },
    ...((watchingList?.length ?? 0) > 0 ? [{ key: "watching" as Tab, label: "Watching" }] : []),
    { key: "dnf", label: "DNF" },
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
        <Link href="/login" className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-green/90 transition-colors">
          Log in
        </Link>
      </div>
    );
  }

  const stats = profile
    ? { watchlist: profile.watchlist_count, watched: profile.watched_count, ratings: profile.ratings_count }
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-glass-8 text-xl font-bold text-glass-55 overflow-hidden">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              user.name[0]?.toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{user.name}</h1>
            <p className="text-sm text-text-subtle">@{user.username}</p>
            {user.bio && <p className="mt-1 text-xs max-w-xs" style={{ color: "var(--text-muted)" }}>{user.bio}</p>}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>Sign out</Button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4 rounded-xl bg-glass-6 p-4">
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats.watched}</p>
            <p className="text-xs text-text-subtle">Watched</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats.ratings}</p>
            <p className="text-xs text-text-subtle">Ratings</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats.watchlist}</p>
            <p className="text-xs text-text-subtle">Shelf</p>
          </div>
        </div>
      )}

      {/* Tribe + Taste */}
      <div className="mb-4"><TribeLabel /></div>
      <div className="mb-6"><TasteIdentityCard /></div>

      {/* Onboarding picks */}
      <FavouritesStrip />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-glass-6 no-scrollbar">
        {tabOrder.map((tab) => {
          const count =
            tab.key === "watchlist" ? profile?.watchlist_count
              : tab.key === "watching" ? watchingList?.length
              : tab.key === "dnf" ? dnfList?.length
              : tab.key === "watched" ? profile?.watched_count
              : tab.key === "slates" ? slatesList?.items.length
              : profile?.ratings_count;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.key ? "text-accent-green" : "text-text-subtle hover:text-glass-55",
              ].join(" ")}
            >
              {tab.label}{count != null && count > 0 ? ` (${count})` : ""}
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

      {/* Media sub-filter (not for Slates) */}
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

        {/* Recent activity — shown below watched/ratings tabs */}
        {(activeTab === "watched" || activeTab === "ratings") && user.id && (
          <RecentActivity userId={user.id} />
        )}
      </div>
    </div>
  );
}
