"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import MoviesLikeBuilder, { type PickedFilm } from "@/components/taste-engine/MoviesLikeBuilder";
import SimilarAnswer, { type SimilarAnswerResponse } from "@/components/discover/SimilarAnswer";
import MovieFilterModal, { languageLabel } from "@/components/discover/MovieFilterModal";
import type { SlateCard } from "@/types/slates";

// sessionStorage key — restores the seed + window across a refresh (no LLM re-call).
const LIKE_KEY = "home.moviesLike";

interface Saved {
  seed: PickedFilm;
  offset: number;
  languages: string[];
}

/*
  MoviesLikeSection — the "Show me something like ___" experience, self-contained
  so Home stays lean. Owns the seed + 5-film window (offset) + language filter,
  and calls POST /api/taste-engine/similar which slices a cached pool server-side.
  "None of these fit" just steps offset by 5 — no re-fetch of a new pool, no
  pagination, no 30-poster dump.
*/
// Read the saved search once, on the client only (sessionStorage is undefined
// during SSR). Used as a lazy initializer so refresh-restore needs no effect.
function loadSaved(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LIKE_KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    return saved?.seed ? saved : null;
  } catch {
    return null;
  }
}

export default function MoviesLikeSection({
  enableSaveAsSlate = false,
}: {
  /** Show the "Save as Slate" bridge under the answer (Search page). */
  enableSaveAsSlate?: boolean;
} = {}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [seed, setSeed] = useState<PickedFilm | null>(() => loadSaved()?.seed ?? null);
  const [offset, setOffset] = useState(() => loadSaved()?.offset ?? 0);
  const [languages, setLanguages] = useState<string[]>(() => loadSaved()?.languages ?? []);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (!seed) return;
    sessionStorage.setItem(LIKE_KEY, JSON.stringify({ seed, offset, languages } satisfies Saved));
  }, [seed, offset, languages]);

  const query = useQuery<SimilarAnswerResponse>({
    // offset + languages are in the key: paging/filtering is a cheap server slice
    // of the cached pool, and each window caches independently.
    queryKey: ["movies-like", seed?.id ?? null, seed?.mediaType ?? "movie", offset, languages.join(",")],
    queryFn: () =>
      apiFetch("/api/taste-engine/similar", {
        method: "POST",
        body: JSON.stringify({
          tmdbId: seed!.id,
          mediaType: seed!.mediaType ?? "movie",
          offset,
          languages,
        }),
      }),
    enabled: !!seed,
    staleTime: Infinity,
  });

  function runSimilar(film: PickedFilm) {
    setSeed(film);
    setOffset(0);
    setLanguages([]);
  }

  function clear() {
    setSeed(null);
    setOffset(0);
    setLanguages([]);
    sessionStorage.removeItem(LIKE_KEY);
  }

  // Save-as-Slate bridge: create a Slate from the current answer, add each
  // film, then land on the new Slate for review/edit.
  const saveAsSlate = useMutation({
    mutationFn: async () => {
      const films = query.data?.answer ?? [];
      const slate = await apiFetch<SlateCard>("/api/slates", {
        method: "POST",
        body: JSON.stringify({
          title: `Like ${seed?.title ?? "this film"}`,
          description: query.data?.essence
            ? `Films that share — ${query.data.essence}`
            : null,
          visibility: "private",
          collaboratorIds: [],
        }),
      });
      for (const f of films) {
        await apiFetch(`/api/slates/${slate.id}/films`, {
          method: "POST",
          body: JSON.stringify({ tmdbId: f.tmdbId, mediaType: "movie" }),
        });
      }
      return slate;
    },
    onSuccess: (slate) => {
      qc.invalidateQueries({ queryKey: ["slates"] });
      router.push(`/slates/${slate.id}`);
    },
  });

  // Language options come from the current pool's answer; stable enough for the modal.
  const present = (query.data?.answer ?? [])
    .map((f) => f.originalLanguage)
    .filter((l): l is string => !!l);

  return (
    <div>
      <MoviesLikeBuilder onSubmit={runSimilar} pending={query.isFetching} value={seed} onClear={clear} />

      {seed && (
        <SimilarAnswer
          data={query.data}
          loading={query.isLoading}
          seedTitle={seed.title}
          onMore={() => setOffset((o) => o + 5)}
          onClear={clear}
          onOpenFilter={query.data ? () => setFilterOpen(true) : undefined}
          languageLabel={languages.length ? languageLabel(languages) : undefined}
          onSaveAsSlate={enableSaveAsSlate ? () => saveAsSlate.mutate() : undefined}
          savingSlate={saveAsSlate.isPending}
        />
      )}

      <MovieFilterModal
        open={filterOpen}
        initial={languages}
        available={[...new Set(present)]}
        onClose={() => setFilterOpen(false)}
        onApply={(codes) => {
          setFilterOpen(false);
          setOffset(0); // a new filter restarts the window
          setLanguages(codes);
        }}
      />
    </div>
  );
}
