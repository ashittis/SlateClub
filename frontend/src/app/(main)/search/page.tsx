"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import { titleHref } from "@/lib/titleHref";
import AddToSlateSheet from "@/components/slates/AddToSlateSheet";
import MoviesLikeSection from "@/components/discover/MoviesLikeSection";
import GenreMoodTileGrid from "@/components/discover/GenreMoodTileGrid";
import PeopleResults from "@/components/discover/PeopleResults";
import Pill from "@/components/ui/Pill";
import SearchFilterBar, {
  applyFilters,
  DEFAULT_FILTERS,
  type SearchFilters,
} from "@/components/discover/SearchFilterBar";
import {
  addRecentSearch,
  getRecentSearches,
  getRecentlyViewed,
  removeRecentSearch,
  removeRecentlyViewed,
  type TitleHit,
} from "@/lib/searchHistory";

type SearchTab = "all" | "films" | "people";

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function metaLine(t: TitleHit): string {
  if (t.mediaType === "tv") {
    if (t.numberOfSeasons)
      return `Series • ${t.numberOfSeasons} Season${t.numberOfSeasons > 1 ? "s" : ""}`;
    return t.year ? `Series • ${t.year}` : "Series";
  }
  return t.year ? `Film • ${t.year}` : "Film";
}

function SearchPageInner() {
  const router = useRouter();
  const qc = useQueryClient();
  // Seed from ?q= so "See all results for '…'" from the top-nav dropdown lands
  // here pre-filled.
  const initialQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebounce(query.trim(), 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const [slateTarget, setSlateTarget] = useState<TitleHit | null>(null);
  const [tab, setTab] = useState<SearchTab>("all");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  const [recentSearches, setRecentSearches] = useState<TitleHit[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<TitleHit[]>([]);
  useEffect(() => {
    if (!debounced) {
      setRecentSearches(getRecentSearches());
      setRecentlyViewed(getRecentlyViewed());
    }
  }, [debounced]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const titles = useQuery<{ results: TitleHit[] }>({
    queryKey: ["search-titles", debounced],
    queryFn: () => apiFetch(`/api/search/titles?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  });

  const orbit = useQuery<{ results: TitleHit[] }>({
    queryKey: ["search-popular-orbit"],
    queryFn: () => apiFetch("/api/search/popular-in-orbit"),
    enabled: !debounced,
  });

  const results = applyFilters(titles.data?.results ?? [], filters);

  const open = (t: TitleHit) => {
    addRecentSearch(t);
    router.push(titleHref(t.tmdbId, t.mediaType));
  };

  const runQuery = (q: string) => {
    setQuery(q);
    setTab("all");
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5"
          style={{ color: "var(--text-faint)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search films and series…"
          className="w-full rounded-full pl-11 pr-4 py-3 text-sm focus:outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Default state — anchor engine, browse tiles, then recents */}
      {!debounced && (
        <div className="space-y-8">
          {/* "Show me something like ___" — the anchor engine with per-result
              "why this matches" + a Save-as-Slate bridge. */}
          <MoviesLikeSection enableSaveAsSlate />

          <GenreMoodTileGrid onPick={runQuery} />

          {recentSearches.length > 0 && (
            <Section title="Recent searches">
              {recentSearches.map((t) => (
                <TitleRow
                  key={`${t.mediaType}-${t.tmdbId}`}
                  t={t}
                  onOpen={() => open(t)}
                  onRemove={() => {
                    removeRecentSearch(t.tmdbId, t.mediaType);
                    setRecentSearches(getRecentSearches());
                  }}
                />
              ))}
            </Section>
          )}
          {recentlyViewed.length > 0 && (
            <Section title="Recently viewed">
              {recentlyViewed.map((t) => (
                <TitleRow
                  key={`${t.mediaType}-${t.tmdbId}`}
                  t={t}
                  onOpen={() => open(t)}
                  onRemove={() => {
                    removeRecentlyViewed(t.tmdbId, t.mediaType);
                    setRecentlyViewed(getRecentlyViewed());
                  }}
                />
              ))}
            </Section>
          )}
          {(orbit.data?.results.length ?? 0) > 0 && (
            <Section title="Popular in your orbit">
              {orbit.data!.results.map((t) => (
                <TitleRow
                  key={`${t.mediaType}-${t.tmdbId}`}
                  t={t}
                  onOpen={() => open(t)}
                  onSlate={() => setSlateTarget(t)}
                />
              ))}
            </Section>
          )}
          {recentSearches.length === 0 &&
            recentlyViewed.length === 0 &&
            (orbit.data?.results.length ?? 0) === 0 && (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                Start typing to search films and series.
              </p>
            )}
        </div>
      )}

      {/* Results — tabbed by entity */}
      {debounced && (
        <div>
          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            {(["all", "films", "people"] as SearchTab[]).map((tb) => (
              <Pill
                key={tb}
                kind="neutral"
                size="sm"
                active={tab === tb}
                onClick={() => setTab(tb)}
                className="capitalize"
              >
                {tb}
              </Pill>
            ))}
          </div>

          {/* Films + All share the film filter bar */}
          {(tab === "all" || tab === "films") && (
            <SearchFilterBar value={filters} onChange={setFilters} />
          )}

          {/* Films list (All + Films tabs) */}
          {(tab === "all" || tab === "films") &&
            (titles.isLoading ? (
              <RowSkeletons />
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                No films for “{debounced}”.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {results.map((t) => (
                  <TitleRow
                    key={`${t.mediaType}-${t.tmdbId}`}
                    t={t}
                    onOpen={() => open(t)}
                    onSlate={() => setSlateTarget(t)}
                  />
                ))}
              </div>
            ))}

          {/* People (All shows a capped preview; People tab shows all) */}
          {tab === "all" && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                People
              </h2>
              <PeopleResults query={debounced} limit={3} />
            </div>
          )}
          {tab === "people" && <PeopleResults query={debounced} />}
        </div>
      )}

      {slateTarget && (
        <AddToSlateSheet
          open={!!slateTarget}
          onClose={() => {
            setSlateTarget(null);
            qc.invalidateQueries({ queryKey: ["search-titles", debounced] });
          }}
          tmdbId={slateTarget.tmdbId}
          mediaType={slateTarget.mediaType}
          title={slateTarget.title}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {title}
      </h2>
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {children}
      </div>
    </section>
  );
}

/* Spotify-style compact row: poster · title · meta · action(+Slate / ✓) | X. */
function TitleRow({
  t,
  onOpen,
  onSlate,
  onRemove,
}: {
  t: TitleHit;
  onOpen: () => void;
  onSlate?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer">
        <div className="h-[78px] w-[52px] shrink-0 overflow-hidden rounded-md" style={{ background: "var(--bg-elevated)" }}>
          {t.posterPath && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={tmdbImage(t.posterPath, "w200")} alt={t.title} className="h-full w-full object-cover" loading="lazy" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold" style={{ color: "var(--text-primary)" }}>{t.title}</p>
          <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>{metaLine(t)}</p>
        </div>
      </button>

      {onSlate &&
        (t.inSlate ? (
          <span
            aria-label="In a Slate"
            title="In a Slate"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ color: "var(--cta-primary)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        ) : (
          <button
            onClick={onSlate}
            aria-label="Add to Slate"
            title="Add to Slate"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:opacity-90 cursor-pointer"
            style={{ border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-muted)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        ))}

      {onRemove && (
        <button onClick={onRemove} aria-label="Remove" className="shrink-0 px-1 text-sm cursor-pointer" style={{ color: "var(--text-faint)" }}>
          ✕
        </button>
      )}
    </div>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="h-[78px] w-[52px] animate-pulse rounded-md" style={{ background: "var(--bg-card)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded" style={{ background: "var(--bg-card)" }} />
            <div className="h-3 w-1/4 animate-pulse rounded" style={{ background: "var(--bg-card)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// useSearchParams() needs a Suspense boundary during prerender.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
