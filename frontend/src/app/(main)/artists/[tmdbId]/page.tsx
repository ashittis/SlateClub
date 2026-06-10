"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import Pill from "@/components/ui/Pill";

interface Filmography {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  character?: string | null;
}

interface ArtistDetail {
  id: string;
  tmdbPersonId: number;
  name: string;
  headshotUrl: string | null;
  roles: string[];
  verified: boolean;
  bio: string | null;
  awards: string[];
  followerCount: number;
  isFollowing: boolean;
  filmography: Filmography[];
}

interface ArtistPost {
  id: string;
  kind: string;
  body: string | null;
  mediaUrl: string | null;
  linkedFilmTmdbId: number | null;
  createdAt: string;
}

interface AMAItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "live" | "ended";
}

type Tab = "posts" | "filmography" | "about" | "amas";

export default function ArtistPage({
  params,
}: {
  params: Promise<{ tmdbId: string }>;
}) {
  const { tmdbId } = use(params);
  const tmdbPersonId = Number(tmdbId);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("filmography");

  const artist = useQuery<ArtistDetail>({
    queryKey: ["artist", tmdbPersonId],
    queryFn: () => apiFetch(`/api/artists/by-tmdb/${tmdbPersonId}`),
    enabled: !!tmdbPersonId,
  });

  const posts = useQuery<{ items: ArtistPost[] }>({
    queryKey: ["artist-posts", artist.data?.id],
    queryFn: () => apiFetch(`/api/artists/${artist.data!.id}/posts`),
    enabled: !!artist.data?.id && tab === "posts",
  });

  const amas = useQuery<{ items: AMAItem[] }>({
    queryKey: ["artist-amas", artist.data?.id],
    queryFn: () => apiFetch(`/api/artists/${artist.data!.id}/amas`),
    enabled: !!artist.data?.id && tab === "amas",
  });

  const follow = useMutation({
    mutationFn: (currentlyFollowing: boolean) =>
      apiFetch(
        `/api/artists/${artist.data!.id}/follow`,
        { method: currentlyFollowing ? "DELETE" : "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artist", tmdbPersonId] }),
  });

  if (artist.isLoading || !artist.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div
          className="h-32 rounded-2xl animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
      </div>
    );
  }

  const a = artist.data;
  const banner = a.filmography.find((f) => f.posterPath)?.posterPath;

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 pt-6 pb-24">
      {/* Cinematic banner */}
      <div
        className="relative -mx-4 lg:-mx-6 h-56 overflow-hidden"
        style={{ background: "var(--bg-elevated)" }}
      >
        {banner && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tmdbImage(banner, "w780")}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,11,0.2) 0%, var(--bg-screening) 100%)",
          }}
        />
      </div>

      <div className="-mt-20 relative px-4 flex items-end gap-4 mb-5">
        <div
          className="w-28 h-28 rounded-full overflow-hidden ring-4 shrink-0"
          style={{
            background: "var(--bg-card)",
            boxShadow: "0 24px 48px -16px rgba(0,0,0,0.6)",
          }}
        >
          {a.headshotUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={a.headshotUrl.startsWith("/") ? tmdbImage(a.headshotUrl, "w300") : a.headshotUrl}
              alt={a.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center display text-3xl font-bold"
              style={{
                background: "var(--cta-primary)",
                color: "var(--bg-screening)",
              }}
            >
              {a.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="display text-2xl lg:text-3xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {a.name}
            </h1>
            {a.verified && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: "var(--pill-mood)",
                  color: "var(--bg-screening)",
                }}
                title="Verified artist"
              >
                ✓ Verified
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {a.roles.map((r) => (
              <Pill key={r} kind="genre" interactive={false} size="sm">
                {r}
              </Pill>
            ))}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            {a.followerCount} follower{a.followerCount === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => follow.mutate(a.isFollowing)}
          className="px-4 py-2 rounded-full text-sm font-semibold"
          style={{
            background: a.isFollowing ? "var(--bg-elevated)" : "var(--cta-primary)",
            color: a.isFollowing ? "var(--text-primary)" : "var(--bg-screening)",
            border: a.isFollowing
              ? "1px solid rgba(255,255,255,0.06)"
              : "none",
          }}
        >
          {a.isFollowing ? "Following" : "Follow"}
        </button>
      </div>

      {/* Tabs */}
      <div
        className="border-b flex gap-2 mb-5"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {(["filmography", "posts", "amas", "about"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-faint)",
                borderBottom: active
                  ? "2px solid var(--cta-primary)"
                  : "2px solid transparent",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === "filmography" && (
        <FilmographyTab tmdbPersonId={tmdbPersonId} fallback={a.filmography} />
      )}

      {tab === "posts" && (
        <div className="space-y-3">
          {posts.data && posts.data.items.length === 0 && (
            <p
              className="text-sm text-center rounded-xl p-6"
              style={{
                color: "var(--text-faint)",
                background: "var(--bg-card)",
                border: "1px dashed rgba(255,255,255,0.06)",
              }}
            >
              No posts yet from {a.name}.
            </p>
          )}
          {posts.data?.items.map((p) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <Pill kind="genre" interactive={false} size="sm">
                {p.kind.replace(/_/g, " ")}
              </Pill>
              {p.body && (
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {p.body}
                </p>
              )}
              {p.linkedFilmTmdbId && (
                <Link
                  href={`/film/${p.linkedFilmTmdbId}`}
                  className="text-xs font-medium mt-2 inline-block"
                  style={{ color: "var(--cta-primary)" }}
                >
                  View linked film →
                </Link>
              )}
            </motion.article>
          ))}
        </div>
      )}

      {tab === "amas" && (
        <div className="space-y-3">
          {amas.data && amas.data.items.length === 0 && (
            <p
              className="text-sm text-center rounded-xl p-6"
              style={{
                color: "var(--text-faint)",
                background: "var(--bg-card)",
                border: "1px dashed rgba(255,255,255,0.06)",
              }}
            >
              No AMAs scheduled.
            </p>
          )}
          {amas.data?.items.map((a) => (
            <article
              key={a.id}
              className="rounded-xl p-4 flex items-center justify-between"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div>
                <p
                  className="display font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {a.title}
                </p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {new Date(a.startsAt).toLocaleString()}
                </p>
              </div>
              <Pill
                kind={a.status === "live" ? "mood" : "neutral"}
                interactive={false}
                size="sm"
              >
                {a.status}
              </Pill>
            </article>
          ))}
        </div>
      )}

      {/* about tab below; filmography is its own component */}
      {tab === "about" && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {a.bio ? (
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {a.bio}
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              Bio not yet added.
            </p>
          )}
          {a.awards.length > 0 && (
            <div className="mt-4">
              <p
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--text-faint)" }}
              >
                Awards
              </p>
              <ul className="text-sm" style={{ color: "var(--text-muted)" }}>
                {a.awards.map((a, i) => (
                  <li key={i}>· {a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilmographyTab({
  tmdbPersonId,
  fallback,
}: {
  tmdbPersonId: number;
  fallback: Filmography[];
}) {
  const [order, setOrder] = useState<"chronological" | "best_to_worst">(
    "chronological",
  );
  const films = useQuery<{ items: Filmography[] }>({
    queryKey: ["filmography", tmdbPersonId, order],
    queryFn: () =>
      apiFetch(
        `/api/cultural/filmography/${tmdbPersonId}?order=${order}&role=all`,
      ),
  });
  const items = films.data?.items ?? fallback;

  return (
    <>
      <div className="flex gap-2 mb-3">
        {(
          [
            { k: "chronological", label: "Chronological" },
            { k: "best_to_worst", label: "Best → worst" },
          ] as const
        ).map((opt) => {
          const active = order === opt.k;
          return (
            <button
              key={opt.k}
              onClick={() => setOrder(opt.k)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: active ? "var(--text-primary)" : "var(--bg-card)",
                color: active ? "var(--bg-screening)" : "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {items.map((f) => (
          <Link
            key={f.tmdbId}
            href={`/film/${f.tmdbId}`}
            className="group flex flex-col gap-1.5"
          >
            <div
              className="aspect-[2/3] rounded-lg overflow-hidden"
              style={{ background: "var(--bg-elevated)" }}
            >
              {f.posterPath && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(f.posterPath, "w300")}
                  alt={f.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              )}
            </div>
            <p
              className="text-xs truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {f.title}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
