"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

interface Tribe {
  cluster_id: string;
  name: string;
  weight: number;
  size: number;
  all_tribes: { cluster_id: string; cluster_name: string; weight: number }[];
}

interface TribeMovie {
  movie_id: string;
  title: string;
  tmdb_id: number;
  raters: number;
  cluster_pct: number;
}

interface TasteNeighbor {
  user_id: string;
  name: string;
  username: string;
  similarity: number;
}

interface GraphRec {
  movie_id: string;
  tmdb_id: number | null;
  title: string | null;
  source: string;
  score: number;
  explanation: string;
}

export default function TribePage() {
  const { user } = useAuthStore();

  const { data: tribeData, isLoading } = useQuery<{ tribe: Tribe | null }>({
    queryKey: ["my-tribe"],
    queryFn: () => apiFetch("/api/tribes/my-tribe"),
    enabled: !!user,
  });

  const tribe = tribeData?.tribe;

  const { data: moviesData } = useQuery<{ movies: TribeMovie[] }>({
    queryKey: ["tribe-movies", tribe?.cluster_id],
    queryFn: () => apiFetch(`/api/tribes/${tribe!.cluster_id}/movies?limit=20`),
    enabled: !!tribe,
  });

  const { data: neighborsData } = useQuery<{ neighbors: TasteNeighbor[] }>({
    queryKey: ["taste-neighbors"],
    queryFn: () => apiFetch("/api/tribes/taste-neighbors"),
    enabled: !!user,
  });

  const { data: graphRecsData } = useQuery<{ recommendations: GraphRec[] }>({
    queryKey: ["graph-recs"],
    queryFn: () => apiFetch("/api/tribes/graph-recommendations?limit=12"),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-glass-8" />
          <div className="h-32 animate-pulse rounded-xl bg-glass-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-24">
      <h1 className="mb-6 text-2xl font-bold text-text-primary">Your Cinematic Tribe</h1>

      {!tribe ? (
        <div className="rounded-xl bg-glass-6 p-8 text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-glass-40">
            Rate more movies to discover your Cinematic Tribe.
            <br />
            We need more data about your taste to find your people.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Primary Tribe Card */}
          <div className="rounded-xl bg-gradient-to-br from-accent-green/20 to-accent-green/5 border border-accent-green/20 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-green text-lg font-bold text-bg-primary">
                🎬
              </div>
              <div>
                <h2 className="text-xl font-bold text-accent-green">{tribe.name}</h2>
                <p className="text-sm text-glass-40">{tribe.size} members · {Math.round(tribe.weight * 100)}% match</p>
              </div>
            </div>
          </div>

          {/* Other Tribes */}
          {tribe.all_tribes.length > 1 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-subtle">Also part of</h3>
              <div className="flex flex-wrap gap-2">
                {tribe.all_tribes.slice(1).map((t) => (
                  <span
                    key={t.cluster_id}
                    className="rounded-full border border-glass-6 px-3 py-1 text-xs text-glass-40"
                  >
                    {t.cluster_name} · {Math.round(t.weight * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tribe Popular Movies */}
          {moviesData?.movies && moviesData.movies.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-subtle">
                Popular in {tribe.name}
              </h3>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {moviesData.movies.map((m) => (
                  <Link key={m.movie_id} href={`/film/${m.tmdb_id}`} className="group">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-glass-8">
                      <div className="flex h-full items-center justify-center text-xs text-glass-15">
                        {m.title}
                      </div>
                      <div className="absolute bottom-1 right-1 rounded bg-accent-green/80 px-1 py-0.5 text-[10px] font-bold text-bg-primary">
                        {Math.round(m.cluster_pct * 100)}%
                      </div>
                    </div>
                    <p className="mt-1 truncate text-xs text-glass-40">{m.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Taste Twins */}
          {neighborsData?.neighbors && neighborsData.neighbors.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-subtle">
                Your Taste Twins
              </h3>
              <div className="space-y-2">
                {neighborsData.neighbors.map((n) => (
                  <Link
                    key={n.user_id}
                    href={`/profile/${n.username}`}
                    className="flex items-center gap-3 rounded-lg bg-glass-6 p-3 hover:bg-glass-8 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-glass-12 text-sm font-bold">
                      {n.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{n.name}</p>
                      <p className="text-xs text-text-subtle">@{n.username}</p>
                    </div>
                    <span className="rounded-full bg-green-glass-15 px-2 py-0.5 text-xs text-accent-green">
                      {Math.round(n.similarity * 100)}% match
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Graph Recommendations */}
          {graphRecsData?.recommendations && graphRecsData.recommendations.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-subtle">
                From Your Graph
              </h3>
              <div className="space-y-2">
                {graphRecsData.recommendations.slice(0, 8).map((r) => (
                  <Link
                    key={r.movie_id}
                    href={`/film/${r.tmdb_id}`}
                    className="flex items-center justify-between rounded-lg bg-glass-6 p-3 hover:bg-glass-8 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{r.title}</p>
                      <p className="text-xs text-text-subtle">{r.explanation}</p>
                    </div>
                    <span className="rounded-full bg-glass-8 px-2 py-0.5 text-xs text-glass-40">
                      {r.source.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
