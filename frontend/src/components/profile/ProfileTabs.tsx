"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import type { PublicProfile } from "@/types/user";
import type { SlateCard as SlateCardType } from "@/types/slates";
import SlateCard from "@/components/slates/SlateCard";
import MediaFilter, { filterByMedia, type MediaFilterValue } from "@/components/profile/MediaFilter";
import { dnfReasonLabel } from "@/lib/shelfReasons";
import { timeAgo, formatDate } from "@/lib/profileFormat";
import {
  GridSkeleton,
  ListSkeleton,
  FilmRow,
  DiaryRow,
  PosterLink,
  ShelfCard,
  type RatedMovie,
  type WatchedMovie,
  type ShelfMovie,
  type DnfMovie,
  type WatchingMovie,
  type DiaryEntryMovie,
} from "@/components/profile/filmDisplays";

type Tab = "films" | "diary" | "ratings" | "watchlist" | "watching" | "dnf" | "lists";

/* ---------- Tab bodies ---------- */

function FilmsTab({ media }: { media: MediaFilterValue }) {
  const { data, isLoading } = useQuery<WatchedMovie[]>({
    queryKey: ["profile", "watched"],
    queryFn: () => apiFetch<WatchedMovie[]>("/api/users/me/watched"),
  });
  if (isLoading) return <GridSkeleton />;
  const movies = filterByMedia(data ?? [], media);
  if (movies.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">Nothing watched yet. Start watching and logging!</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {movies.map((m) => <PosterLink key={m.id} movie={m} />)}
    </div>
  );
}

function DiaryTab({ media }: { media: MediaFilterValue }) {
  // Per-viewing diary: rewatches show as separate dated rows (unlike Films).
  const { data, isLoading } = useQuery<DiaryEntryMovie[]>({
    queryKey: ["profile", "diary"],
    queryFn: () => apiFetch<DiaryEntryMovie[]>("/api/diary"),
  });
  if (isLoading) return <ListSkeleton />;
  const entries = filterByMedia(data ?? [], media);
  if (entries.length === 0)
    return <p className="py-12 text-center text-sm text-text-subtle">Your diary is empty. Log a film to start it.</p>;
  return (
    <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      {entries.map((e) => (
        <DiaryRow key={e.entryId} entry={e} />
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
          <FilmRow key={m.id} movie={m} rating={m.userRating} dateLabel={m.ratedAt ? formatDate(m.ratedAt) : undefined} />
        ))}
      </div>
    </div>
  );
}

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

function ListsTab() {
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
    return <p className="py-12 text-center text-sm text-text-subtle">No lists yet. Create one from the Slates tab.</p>;
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

/* ---------- Tab shell ---------- */

interface Props {
  profile: PublicProfile | null;
  watchingCount: number;
  dnfCount: number;
  listsCount: number;
}

export default function ProfileTabs({ profile, watchingCount, dnfCount, listsCount }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("films");
  const [media, setMedia] = useState<MediaFilterValue>("all");

  const tabOrder: { key: Tab; label: string; count?: number }[] = [
    { key: "films", label: "Films", count: profile?.watched_count },
    { key: "diary", label: "Diary", count: profile?.watched_count },
    { key: "ratings", label: "Ratings", count: profile?.ratings_count },
    { key: "watchlist", label: "Watchlist", count: profile?.watchlist_count },
    ...(watchingCount > 0 ? [{ key: "watching" as Tab, label: "Watching", count: watchingCount }] : []),
    { key: "dnf", label: "DNF", count: dnfCount },
    { key: "lists", label: "Lists", count: listsCount },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-glass-6 no-scrollbar">
        {tabOrder.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key ? "text-accent-green" : "text-text-subtle hover:text-glass-55",
            ].join(" ")}
          >
            {tab.label}{tab.count != null && tab.count > 0 ? ` (${tab.count})` : ""}
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

      {/* Media sub-filter (not for Lists) */}
      {activeTab !== "lists" && (
        <div className="mb-4">
          <MediaFilter value={media} onChange={setMedia} layoutId="profile-media" />
        </div>
      )}

      {/* Tab body */}
      <div className="pb-8">
        {activeTab === "films" && <FilmsTab media={media} />}
        {activeTab === "diary" && <DiaryTab media={media} />}
        {activeTab === "ratings" && <RatingsTab media={media} />}
        {activeTab === "watchlist" && <WatchlistTab media={media} />}
        {activeTab === "watching" && <WatchingTab media={media} />}
        {activeTab === "dnf" && <DnfTab media={media} />}
        {activeTab === "lists" && <ListsTab />}
      </div>
    </div>
  );
}
