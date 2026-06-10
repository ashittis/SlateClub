"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import OrbitButton from "@/components/social/OrbitButton";
import TwinBadge from "@/components/social/TwinBadge";
import TasteMatchCard from "@/components/social/TasteMatchCard";
import StarRating from "@/components/ratings/StarRating";
import CriticBadge from "@/components/social/CriticBadge";
import { dnfReasonLabel } from "@/lib/shelfReasons";
import { titleHref } from "@/lib/titleHref";
import MediaFilter, {
  filterByMedia,
  type MediaFilterValue,
} from "@/components/profile/MediaFilter";
import SlateCard from "@/components/slates/SlateCard";
import type { SlateCard as SlateCardType } from "@/types/slates";
import type {
  FilmCardLite,
  MutualTwin,
  PublicProfile,
  TasteMatch,
  TwinScore,
} from "@/types/user";

type Tab = "ratings" | "watchlist" | "watching" | "dnf" | "slates";

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = params.username;
  const { user: currentUser } = useAuthStore();

  const startChat = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ conversationId: string }>(`/api/chat/conversations/with/${userId}`, { method: "POST" }),
    onSuccess: (data) => router.push(`/messages/${data.conversationId}`),
  });
  const [activeTab, setActiveTab] = useState<Tab>("ratings");
  const [media, setMedia] = useState<MediaFilterValue>("all");

  // Currently Watching (series) — its tab only shows when non-empty.
  const watching = useQuery<{ id: string }[]>({
    queryKey: ["user-library", username, "watching"],
    queryFn: () => apiFetch(`/api/users/${username}/watching`),
    enabled: !!username,
  });

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ["user-profile", username],
    queryFn: () => apiFetch(`/api/users/${username}`),
    enabled: !!username,
  });

  const isOwnProfile = currentUser?.username === username;

  const twin = useQuery<TwinScore>({
    queryKey: ["twin-score", username],
    queryFn: () => apiFetch(`/api/users/${username}/twin-score`),
    enabled: !!username && !!currentUser && !isOwnProfile,
  });

  const youdBoth = useQuery<{ items: FilmCardLite[] }>({
    queryKey: ["youd-both-love", username],
    queryFn: () =>
      apiFetch(`/api/users/${username}/films-youd-both-love`),
    enabled: !!username && !!currentUser && !isOwnProfile,
  });

  const mutuals = useQuery<{ items: MutualTwin[] }>({
    queryKey: ["mutual-twins", username],
    queryFn: () => apiFetch(`/api/users/${username}/mutual-twins`),
    enabled: !!username && !!currentUser && !isOwnProfile,
  });

  const matchCut = useQuery<TasteMatch>({
    queryKey: ["match-cut", username],
    queryFn: () => apiFetch(`/api/match-cut/${username}`),
    enabled: !!username && !!currentUser && !isOwnProfile,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="mb-6 flex items-center gap-4">
          <div
            className="h-16 w-16 animate-pulse rounded-full"
            style={{ background: "var(--bg-card)" }}
          />
          <div className="space-y-2">
            <div
              className="h-5 w-32 animate-pulse rounded"
              style={{ background: "var(--bg-card)" }}
            />
            <div
              className="h-3 w-20 animate-pulse rounded"
              style={{ background: "var(--bg-card)" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <p
        className="px-4 py-20 text-center"
        style={{ color: "var(--text-faint)" }}
      >
        User not found.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 pt-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold display"
            style={{
              background: "var(--cta-primary)",
              color: "var(--bg-screening)",
            }}
          >
            {profile.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              profile.name[0]?.toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="display text-xl lg:text-2xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {profile.name}
              </h1>
              <CriticBadge username={profile.username} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              @{profile.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {twin.data && !twin.data.isSelf && (
            <TwinBadge
              score={twin.data.score}
              overlapCount={twin.data.overlapCount}
            />
          )}
          {!isOwnProfile && currentUser && profile.id && (
            <>
              <button
                onClick={() => startChat.mutate(profile.id)}
                disabled={startChat.isPending}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
                style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {startChat.isPending ? "…" : "Message"}
              </button>
              <OrbitButton userId={profile.id} />
            </>
          )}
          {isOwnProfile && (
            <Link
              href="/profile"
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 sm:grid-cols-5 gap-3">
        <Stat label="Ratings" value={profile.ratings_count} />
        <Stat label="Watched" value={profile.watched_count} />
        <Stat label="Shelf" value={profile.watchlist_count} />
        <Stat label="Followers" value={profile.followers_count} />
        <Stat label="Following" value={profile.following_count} />
      </div>

      {profile.bio && (
        <p
          className="mb-6 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {profile.bio}
        </p>
      )}

      {/* Match Cut — taste compatibility */}
      {!isOwnProfile && matchCut.data && (
        <TasteMatchCard
          match={matchCut.data}
          targetUsername={profile.username}
          targetName={profile.name}
        />
      )}

      {/* Films you'd both love */}
      {!isOwnProfile && youdBoth.data && youdBoth.data.items.length > 0 && (
        <section className="mb-8">
          <h2
            className="display text-lg font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Films you&apos;d both love
          </h2>
          <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
            <div className="flex gap-3 lg:grid lg:grid-cols-6">
              {youdBoth.data.items.map((m) => (
                <Link
                  key={m.tmdbId}
                  href={`/film/${m.tmdbId}`}
                  className="shrink-0 w-[120px] lg:w-auto"
                >
                  <div
                    className="aspect-[2/3] rounded-lg overflow-hidden"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    {m.posterPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={tmdbImage(m.posterPath, "w300")}
                        alt={m.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <p
                    className="mt-2 text-xs truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {m.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Mutual twins */}
      {!isOwnProfile && mutuals.data && mutuals.data.items.length > 0 && (
        <section className="mb-8">
          <h2
            className="display text-lg font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Mutual twins
          </h2>
          <div className="flex gap-4 flex-wrap">
            {mutuals.data.items.map((m) => (
              <Link
                key={m.id}
                href={`/profile/${m.username}`}
                className="flex flex-col items-center gap-1.5 w-16"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-muted)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {m.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.avatarUrl}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    m.name[0]?.toUpperCase()
                  )}
                </div>
                <span
                  className="text-xs text-center truncate w-full"
                  style={{ color: "var(--text-muted)" }}
                >
                  {m.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div
        className="mb-4 flex border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {([
          { key: "ratings", label: "Ratings" },
          { key: "watchlist", label: "Shelf" },
          ...((watching.data?.length ?? 0) > 0
            ? [{ key: "watching" as Tab, label: "Watching" }]
            : []),
          { key: "dnf", label: "DNF" },
          { key: "slates", label: "Slates" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 py-2 text-sm font-medium transition-colors relative"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-faint)",
                borderBottom: active
                  ? "2px solid var(--cta-primary)"
                  : "2px solid transparent",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab !== "slates" && (
        <div className="mb-4">
          <MediaFilter value={media} onChange={setMedia} layoutId="view-media" />
        </div>
      )}

      <div className="pb-8">
        {activeTab === "slates" ? (
          <UserSlatesGrid username={username} />
        ) : (
          <UserLibraryGrid username={username} kind={activeTab} media={media} />
        )}
      </div>
    </div>
  );
}

interface LibraryFilm {
  id: string;
  tmdbId: number;
  mediaType?: string | null;
  title: string;
  posterPath: string | null;
  userRating?: number;
  reason?: string | null;
  startedAt?: string;
}

const EMPTY_TEXT: Record<Tab, string> = {
  ratings: "No ratings yet.",
  watchlist: "Shelf is empty.",
  watching: "Nothing in progress.",
  dnf: "Nothing abandoned.",
  slates: "No slates yet.",
};

function UserSlatesGrid({ username }: { username: string }) {
  const { data, isLoading } = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["user-slates", username],
    queryFn: () => apiFetch(`/api/slates/by-user/${username}`),
    enabled: !!username,
  });
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl" style={{ background: "var(--bg-card)" }} />
        ))}
      </div>
    );
  }
  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>
        No public slates yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((s) => (
        <SlateCard key={s.id} slate={s} />
      ))}
    </div>
  );
}

function UserLibraryGrid({
  username,
  kind,
  media,
}: {
  username: string;
  kind: Tab;
  media: MediaFilterValue;
}) {
  const { data, isLoading } = useQuery<LibraryFilm[]>({
    queryKey: ["user-library", username, kind],
    queryFn: () => apiFetch(`/api/users/${username}/${kind}`),
    enabled: !!username,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg" style={{ background: "var(--bg-card)" }} />
        ))}
      </div>
    );
  }
  const items = filterByMedia(data ?? [], media);
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>
        {EMPTY_TEXT[kind]}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {items.map((m) => (
        <Link key={m.id} href={titleHref(m.tmdbId, m.mediaType)} className="group block">
          <div className="aspect-[2/3] overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
            {m.posterPath && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tmdbImage(m.posterPath, "w300")}
                alt={m.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            )}
          </div>
          {kind === "ratings" && m.userRating != null ? (
            /* Ratings: star icons under the poster, no title */
            <div className="mt-1.5">
              <StarRating value={m.userRating} readonly size="sm" />
            </div>
          ) : (
            <>
              <p className="mt-1.5 truncate text-xs" style={{ color: "var(--text-primary)" }}>
                {m.title}
              </p>
              {kind === "dnf" && dnfReasonLabel(m.reason) && (
                <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                  {dnfReasonLabel(m.reason)}
                </p>
              )}
              {kind === "watching" && (
                <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                  In progress
                </p>
              )}
            </>
          )}
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p
        className="display text-xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      <p
        className="text-[10px] uppercase tracking-wider mt-0.5"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
    </div>
  );
}
