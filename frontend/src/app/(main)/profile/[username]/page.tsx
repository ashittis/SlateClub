"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import FollowButton from "@/components/social/FollowButton";
import TwinBadge from "@/components/social/TwinBadge";
import CriticBadge from "@/components/social/CriticBadge";
import type {
  FilmCardLite,
  MutualTwin,
  PublicProfile,
  TwinScore,
} from "@/types/user";

type Tab = "ratings" | "watchlist";

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("ratings");

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ["user-profile", username],
    queryFn: () => apiFetch(`/api/users/${username}`),
    enabled: !!username,
  });

  const isOwnProfile = currentUser?.username === username;

  const followCheck = useQuery({
    queryKey: ["follow-check", profile?.id],
    queryFn: () =>
      apiFetch<{ isFollowing: boolean }>(
        `/api/follows/${profile?.id}/check`,
      ),
    enabled: !!profile?.id && !isOwnProfile && !!currentUser,
  });

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
            <FollowButton
              userId={profile.id}
              initialFollowing={followCheck.data?.isFollowing}
            />
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
        <Stat label="Watchlist" value={profile.watchlist_count} />
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
        {(["ratings", "watchlist"] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 text-sm font-medium capitalize transition-colors relative"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-faint)",
                borderBottom: active
                  ? "2px solid var(--cta-primary)"
                  : "2px solid transparent",
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        Other users&apos; activity grids will land here once the per-user
        ratings/watchlist endpoints accept a target user. Today these endpoints
        are scoped to the requesting user only.
      </p>
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
