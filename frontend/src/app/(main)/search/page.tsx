"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import Page from "@/components/layout/Page";
import { searchApi, searchKeys } from "@/lib/api/search";
import { filmKeys, filmsApi } from "@/lib/api/films";
import { addRecentSearch, getRecentSearches, clearRecentSearches } from "@/lib/searchHistory";
import FilmCard, { type FilmCardFilm } from "@/components/film/FilmCard";
import { useQuickActions } from "@/components/film/useQuickActions";

/**
 * Search — a primary destination and the door into discovery (KASET.md §8).
 *
 * Empty state is not empty: recent searches, what the people you follow have
 * been watching, and what's trending. There is no separate Discover
 * destination, so this page has to earn that absence.
 *
 * The evidence-backed discovery modules arrive in Phase 8; the shelves here are
 * the honest version of what we can serve today.
 *
 * The top bar's field hands its query over through `?q=`, so this page has to
 * read the URL as well as its own input. `useSearchParams` suspends during
 * prerender, hence the boundary below.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchBody />
    </Suspense>
  );
}

function SearchBody() {
  const params = useSearchParams();
  const { open: openQuickActions, sheet: quickActionsSheet } = useQuickActions();

  // Arriving from the top bar, or on a shared/bookmarked result. Only the URL
  // drives this — typing here deliberately does not rewrite the address bar, or
  // every keystroke would land in browser history.
  const urlQuery = params.get("q") ?? "";

  const [q, setQ] = useState(urlQuery);
  const [debounced, setDebounced] = useState(urlQuery);
  const [tab, setTab] = useState<"films" | "people">("films");
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => setRecents(getRecentSearches()), []);

  // Adjusted during render, not in an effect: an effect would paint the previous
  // query for a frame before replacing it, which reads as a flicker on every
  // search submitted from the bar.
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    if (urlQuery) setQ(urlQuery);
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const active = debounced.length > 0;

  const { data: films, isFetching: filmsLoading } = useQuery({
    queryKey: searchKeys.films(debounced),
    queryFn: () => searchApi.films(debounced),
    enabled: active && tab === "films",
  });

  const { data: people, isFetching: peopleLoading } = useQuery({
    queryKey: searchKeys.people(debounced),
    queryFn: () => searchApi.people(debounced),
    enabled: active && tab === "people",
  });

  const { data: following } = useQuery({
    queryKey: searchKeys.popularAmongFollowing(),
    queryFn: () => searchApi.popularAmongFollowing(),
    enabled: !active,
  });

  const { data: trending } = useQuery({
    queryKey: filmKeys.search("__trending"),
    queryFn: () => filmsApi.trending(),
    enabled: !active,
  });

  const commit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    addRecentSearch(t);
    setRecents(getRecentSearches());
  };

  return (
    <Page>
      <h1 className="sr-only">Search</h1>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          commit(q);
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => commit(q)}
          placeholder="Search films and people"
          autoComplete="off"
          autoFocus={!urlQuery}
          className="pill min-h-[52px] w-full border px-4 text-base outline-none"
          style={{
            borderColor: "var(--edge-hot)",
            background: "var(--soot)",
            color: "var(--chalk)",
          }}
        />
      </form>

      {active && (
        <div
          className="mt-4 flex gap-4 border-b"
          style={{ borderColor: "var(--edge)" }}
        >
          {(["films", "people"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="min-h-[44px] border-b-2 px-1 text-sm font-medium capitalize"
              style={{
                borderColor: tab === t ? "var(--edge-hot)" : "transparent",
                color: tab === t ? "var(--chalk)" : "var(--xerox)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {active ? (
        tab === "films" ? (
          <Results
            loading={filmsLoading}
            empty={!films?.results.length}
            emptyLabel={`No films matching “${debounced}”.`}
          >
            <PosterGrid films={films?.results ?? []} onQuickActions={openQuickActions} />
          </Results>
        ) : (
          <Results
            loading={peopleLoading}
            empty={!people?.results.length}
            emptyLabel={`No people matching “${debounced}”.`}
          >
            <ul className="mt-4 border-t" style={{ borderColor: "var(--edge)" }}>
              {(people?.results ?? []).map((p) => (
                <li key={p.tmdbId} className="border-b" style={{ borderColor: "var(--edge)" }}>
                  <Link
                    href={`/person/${p.tmdbId}`}
                    className="row-hover flex min-h-[60px] items-center gap-3 px-2 py-2"
                  >
                    <Image
                      src={tmdbImage(p.profilePath, "w200")}
                      alt=""
                      width={40}
                      height={40}
                      className="poster h-10 w-10 shrink-0 rounded-full object-cover"
                      unoptimized
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="meta block truncate">
                        {[p.department, ...(p.knownFor ?? [])].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Results>
        )
      ) : (
        <div className="mt-6 space-y-8">
          {recents.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="section-label">Recent searches</h2>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    setRecents([]);
                  }}
                  className="meta"
                  style={{ color: "var(--blood-ink)" }}
                >
                  clear
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {recents.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => setQ(r)}
                      className="pill min-h-[40px] border px-4 text-sm"
                      style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
                    >
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(following?.results.length ?? 0) > 0 && (
            <Shelf
            onQuickActions={openQuickActions}
              title="Watched by people you follow"
              films={following?.results ?? []}
            />
          )}

          <Shelf title="Trending this week" films={trending?.results ?? []} onQuickActions={openQuickActions} />
        </div>
      )}

      {quickActionsSheet}
    </Page>
  );
}

function Results({
  loading,
  empty,
  emptyLabel,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (loading && empty) return <p className="meta mt-4">Searching…</p>;
  if (empty)
    return (
      <p className="mt-4 text-sm" style={{ color: "var(--xerox)" }}>
        {emptyLabel}
      </p>
    );
  return <>{children}</>;
}

function Shelf({
  title,
  films,
  onQuickActions,
}: {
  title: string;
  films: { tmdbId: number; title: string; posterPath: string | null; year: string | null }[];
  onQuickActions?: (f: FilmCardFilm) => void;
}) {
  if (films.length === 0) return null;
  return (
    <section>
      <h2 className="section-label">{title}</h2>
      <ul className="no-scrollbar mt-2 flex gap-3 overflow-x-auto pb-1">
        {films.map((f) => (
          <li key={f.tmdbId} className="shrink-0">
            <FilmCard film={f} width={104} onQuickActions={onQuickActions} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PosterGrid({
  films,
  onQuickActions,
}: {
  films: { tmdbId: number; title: string; posterPath: string | null; year: string | null }[];
  onQuickActions?: (f: FilmCardFilm) => void;
}) {
  return (
    <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {films.map((f) => (
        <li key={f.tmdbId} className="w-full">
          <FilmCard film={f} width={120} onQuickActions={onQuickActions} />
        </li>
      ))}
    </ul>
  );
}
