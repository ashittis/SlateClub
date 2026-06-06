"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import Section from "@/components/discover/Section";
import RankedRow, { type TrendingItem } from "@/components/discover/RankedRow";
import PlatformTiles, {
  type PlatformItem,
} from "@/components/discover/PlatformTile";
import ArtistCircleRow, {
  type ArtistItem,
} from "@/components/discover/ArtistCircle";
import AwardRow, { type AwardItem } from "@/components/discover/AwardTile";
import TwinRail, { type TwinNowItem } from "@/components/discover/TwinRail";
import SlateCard from "@/components/slates/SlateCard";
import type { SlateCard as SlateCardType } from "@/types/slates";
import SentenceBuilder, {
  type Sentence,
} from "@/components/taste-engine/SentenceBuilder";
import BubbleConstellation, {
  type ConstellationFilm,
} from "@/components/taste-engine/BubbleConstellation";
import MoviesLikeBuilder, {
  type PickedFilm,
} from "@/components/taste-engine/MoviesLikeBuilder";
import SimilarResultsGrid, {
  type SimilarResponse,
} from "@/components/discover/SimilarResultsGrid";
import MovieFilterModal, {
  languageLabel,
} from "@/components/discover/MovieFilterModal";
import { useMutation } from "@tanstack/react-query";

const EMPTY: Sentence = {
  mood: null,
  genre: null,
  language: null,
  platform: null,
  era: null,
};

// sessionStorage key for the "movies like" seed + language filter (survives refresh).
const LIKE_KEY = "discover.moviesLike";

function toQuery(s: Sentence): string {
  const params = new URLSearchParams();
  (Object.keys(s) as (keyof Sentence)[]).forEach((k) => {
    const v = s[k];
    if (v) params.set(k, v);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default function DiscoverPage() {
  // Inline Taste Engine — collapsed pill on mobile, expanded panel on desktop.
  const [sentence, setSentence] = useState<Sentence>(EMPTY);
  const [debouncedSentence, setDebouncedSentence] = useState<Sentence>(EMPTY);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSentence(sentence), 250);
    return () => clearTimeout(t);
  }, [sentence]);

  const countQuery = useQuery<{ count: number }>({
    queryKey: ["taste-engine-count", debouncedSentence],
    queryFn: () =>
      apiFetch(`/api/taste-engine/match-count${toQuery(debouncedSentence)}`),
  });
  const queryMutation = useMutation<
    { results: ConstellationFilm[]; matchedCount: number },
    Error,
    Sentence
  >({
    mutationFn: (s) =>
      apiFetch("/api/taste-engine/query", {
        method: "POST",
        body: JSON.stringify(s),
      }),
  });

  // "Show me movies like ___" — ONE essence call fetches a broad, language-diverse
  // set; the language filter narrows it client-side. Seed + results are cached to
  // sessionStorage so a browser refresh restores instantly (no LLM re-call).
  const queryClient = useQueryClient();
  const [seedFilm, setSeedFilm] = useState<PickedFilm | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Restore after a refresh: pre-seed the query cache with the saved response so
  // the query renders immediately and does not refetch (staleTime: Infinity).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LIKE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        seed: PickedFilm;
        languages?: string[];
        data?: SimilarResponse;
      };
      if (!saved?.seed) return;
      if (saved.data) {
        queryClient.setQueryData(["movies-like", saved.seed.id], saved.data);
      }
      setSeedFilm(saved.seed);
      setLanguages(saved.languages ?? []);
    } catch {
      /* ignore malformed storage */
    }
  }, [queryClient]);

  const similarQuery = useQuery<SimilarResponse>({
    queryKey: ["movies-like", seedFilm?.id ?? null],
    queryFn: () =>
      apiFetch("/api/taste-engine/similar", {
        method: "POST",
        body: JSON.stringify({ tmdbId: seedFilm!.id, limit: 30 }),
      }),
    enabled: !!seedFilm,
    staleTime: Infinity,
  });

  // Persist the seed + filter + the full response so a refresh restores it all.
  useEffect(() => {
    if (seedFilm && similarQuery.data) {
      sessionStorage.setItem(
        LIKE_KEY,
        JSON.stringify({ seed: seedFilm, languages, data: similarQuery.data }),
      );
    }
  }, [seedFilm, languages, similarQuery.data]);

  // Client-side language filter over the single fetched set (no re-call).
  const fullResults = similarQuery.data?.results ?? [];
  const presentLanguages = useMemo(
    () => [...new Set(fullResults.map((f) => f.originalLanguage).filter(Boolean))] as string[],
    [fullResults],
  );
  const similarDisplay: SimilarResponse | undefined = useMemo(() => {
    if (!similarQuery.data) return undefined;
    const filtered = languages.length
      ? fullResults.filter(
          (f) => f.originalLanguage && languages.includes(f.originalLanguage),
        )
      : fullResults;
    return {
      ...similarQuery.data,
      results: filtered.slice(0, 18), // ~3 rows
      creatorRow: languages.length ? null : similarQuery.data.creatorRow,
    };
  }, [similarQuery.data, fullResults, languages]);

  function runSimilar(film: PickedFilm) {
    setSeedFilm(film);
    setLanguages([]);
  }

  function clearSimilar() {
    setSeedFilm(null);
    setLanguages([]);
    sessionStorage.removeItem(LIKE_KEY);
  }

  // Sectioned data
  const trending = useQuery<{
    theatrical: TrendingItem[];
    ott: TrendingItem[];
  }>({
    queryKey: ["discover-trending"],
    queryFn: () => apiFetch("/api/discover/trending"),
  });
  const platforms = useQuery<{ items: PlatformItem[] }>({
    queryKey: ["discover-platforms"],
    queryFn: () => apiFetch("/api/discover/by-platform"),
  });
  const artists = useQuery<{ items: ArtistItem[] }>({
    queryKey: ["discover-artists"],
    queryFn: () => apiFetch("/api/discover/artists-radar"),
  });
  const awards = useQuery<{ items: AwardItem[] }>({
    queryKey: ["discover-awards"],
    queryFn: () => apiFetch("/api/discover/awards"),
  });
  const twins = useQuery<{ items: TwinNowItem[] }>({
    queryKey: ["twins-now"],
    queryFn: () => apiFetch("/api/feed/twins-now"),
    refetchInterval: 60_000,
  });
  const featuredSlates = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates-featured"],
    queryFn: () => apiFetch("/api/slates/featured"),
  });
  const hiddenGems = useQuery<{
    items: {
      tmdbId: number;
      title: string;
      posterPath: string | null;
      twinHighRatings: number;
      globalVoteCount: number | null;
    }[];
  }>({
    queryKey: ["hidden-gems"],
    queryFn: () => apiFetch("/api/cultural/hidden-gems"),
  });
  const twinSlates = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates-from-twins"],
    queryFn: () => apiFetch("/api/slates/from-twins"),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        Discover
      </h1>

      {/* Taste Engine — full sentence builder + inline constellation on desktop. */}
      <div className="mt-5">
        <SentenceBuilder
          value={sentence}
          onChange={setSentence}
          onSubmit={() => queryMutation.mutate(sentence)}
          matchCount={countQuery.data?.count ?? null}
          loadingCount={countQuery.isLoading || countQuery.isFetching}
        />
        {queryMutation.isPending && (
          <p
            className="text-sm text-center mt-4"
            style={{ color: "var(--text-faint)" }}
          >
            Tuning the constellation…
          </p>
        )}
        {queryMutation.data && queryMutation.data.results.length === 0 && (
          <p
            className="text-sm text-center mt-4 rounded-xl p-4"
            style={{
              color: "var(--text-faint)",
              background: "var(--bg-card)",
              border: "1px dashed rgba(255,255,255,0.06)",
            }}
          >
            No films match — try removing a pill.
          </p>
        )}
        {queryMutation.data && queryMutation.data.results.length > 0 && (
          <div className="mt-4">
            <BubbleConstellation
              films={queryMutation.data.results}
              height={520}
            />
          </div>
        )}
      </div>

      {/* OR divider — second way into the Taste Engine. */}
      <div className="my-6 flex items-center gap-4" aria-hidden>
        <span
          className="h-px flex-1"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
        <span
          className="text-xs uppercase tracking-[0.3em]"
          style={{ color: "var(--text-faint)" }}
        >
          or
        </span>
        <span
          className="h-px flex-1"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
      </div>

      {/* Show me movies like ___ */}
      <div>
        <MoviesLikeBuilder
          onSubmit={(film) => runSimilar(film)}
          pending={similarQuery.isFetching}
          value={seedFilm}
          onClear={clearSimilar}
        />
        <SimilarResultsGrid
          data={similarDisplay}
          loading={similarQuery.isLoading && !!seedFilm}
          languageLabel={languages.length ? languageLabel(languages) : undefined}
          onOpenFilter={
            similarQuery.data && seedFilm
              ? () => setFilterOpen(true)
              : undefined
          }
        />
        <MovieFilterModal
          open={filterOpen}
          initial={languages}
          available={presentLanguages}
          onClose={() => setFilterOpen(false)}
          onApply={(codes) => {
            setFilterOpen(false);
            setLanguages(codes); // client-side filter — no re-fetch
          }}
        />
      </div>

      <Section
        title="In theatres now"
        hint="Recent theatrical releases across industries."
      >
        {trending.isLoading ? (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Loading…
          </p>
        ) : (
          <RankedRow items={trending.data?.theatrical ?? []} />
        )}
      </Section>

      <Section
        title="New on OTT"
        hint="Just landed on streaming."
      >
        {trending.isLoading ? (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Loading…
          </p>
        ) : (
          <RankedRow items={trending.data?.ott ?? []} />
        )}
      </Section>

      <Section
        title="Slates worth saving"
        hint="Curated film collections."
        href="/slates"
      >
        {featuredSlates.isLoading ? null : featuredSlates.data &&
          featuredSlates.data.items.length > 0 ? (
          <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
            <div className="flex gap-4 lg:grid lg:grid-cols-4">
              {featuredSlates.data.items.map((s) => (
                <div key={s.id} className="shrink-0 w-[260px] lg:w-auto">
                  <SlateCard slate={s} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p
            className="text-sm rounded-xl p-4"
            style={{
              color: "var(--text-faint)",
              background: "var(--bg-card)",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
          >
            Be the first to publish a Slate.{" "}
            <Link
              href="/slates/new"
              className="font-medium"
              style={{ color: "var(--cta-primary)" }}
            >
              Create one →
            </Link>
          </p>
        )}
      </Section>

      <Section title="Browse by platform" hint="Only what you can actually watch.">
        {platforms.isLoading ? null : (
          <PlatformTiles items={platforms.data?.items ?? []} />
        )}
      </Section>

      <Section
        title="Artists on your radar"
        hint="Drawn from your favourites + your follow graph."
      >
        {artists.isLoading ? null : (
          <ArtistCircleRow items={artists.data?.items ?? []} />
        )}
      </Section>

      <Section title="Awards" hint="Browse by ceremony.">
        {awards.isLoading ? null : <AwardRow items={awards.data?.items ?? []} />}
      </Section>

      <Section title="Your twins right now" hint="Live — refreshed every minute.">
        {twins.isLoading ? null : (
          <TwinRail items={twins.data?.items ?? []} />
        )}
      </Section>

      <Section
        title="Hidden gems"
        hint="Loved by your twins, under-rated globally."
      >
        {hiddenGems.isLoading ? null : hiddenGems.data &&
          hiddenGems.data.items.length > 0 ? (
          <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
            <div className="flex gap-3 lg:grid lg:grid-cols-6">
              {hiddenGems.data.items.map((g) => (
                <Link
                  key={g.tmdbId}
                  href={`/film/${g.tmdbId}`}
                  className="shrink-0 w-[120px] lg:w-auto"
                >
                  <div
                    className="relative aspect-[2/3] rounded-lg overflow-hidden"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    {g.posterPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`https://image.tmdb.org/t/p/w300${g.posterPath}`}
                        alt={g.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <span
                      className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "var(--pill-mood)",
                        color: "var(--bg-screening)",
                      }}
                    >
                      {g.twinHighRatings}★ twins
                    </span>
                  </div>
                  <p
                    className="mt-2 text-xs truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {g.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p
            className="text-xs px-1"
            style={{ color: "var(--text-faint)" }}
          >
            Nothing yet — collect a few twin ratings and gems will surface.
          </p>
        )}
      </Section>

      <Section
        title="From your twins' shelves"
        hint="Slates curated by people who watch like you."
        href="/slates?tab=saved"
      >
        {twinSlates.isLoading ? null : twinSlates.data &&
          twinSlates.data.items.length > 0 ? (
          <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
            <div className="flex gap-4 lg:grid lg:grid-cols-4">
              {twinSlates.data.items.map((s) => (
                <div key={s.id} className="shrink-0 w-[260px] lg:w-auto">
                  <SlateCard slate={s} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p
            className="text-sm rounded-xl p-4"
            style={{
              color: "var(--text-faint)",
              background: "var(--bg-card)",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
          >
            Once your twins start curating, their collections appear here.
          </p>
        )}
      </Section>

    </div>
  );
}
