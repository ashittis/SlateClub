// Lightweight client-side search memory (localStorage). Used by the search
// page's empty state — no backend needed. Both lists store title rows so they
// render with the same poster · title · metadata layout.

export interface TitleHit {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  year: string | null;
  numberOfSeasons?: number | null;
  inSlate?: boolean;
}

const SEARCHES_KEY = "search.recentSearches";
const VIEWED_KEY = "search.recentlyViewed";
const MAX = 8;

function read(key: string): TitleHit[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as TitleHit[];
  } catch {
    return [];
  }
}

function write(key: string, items: TitleHit[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* quota / disabled — ignore */
  }
}

function upsert(key: string, hit: TitleHit) {
  const next = [
    hit,
    ...read(key).filter(
      (x) => !(x.tmdbId === hit.tmdbId && x.mediaType === hit.mediaType),
    ),
  ];
  write(key, next);
}

function drop(key: string, tmdbId: number, mediaType: string) {
  write(
    key,
    read(key).filter((x) => !(x.tmdbId === tmdbId && x.mediaType === mediaType)),
  );
}

// Titles opened from the search results.
export const getRecentSearches = (): TitleHit[] => read(SEARCHES_KEY);
export const addRecentSearch = (hit: TitleHit) => upsert(SEARCHES_KEY, hit);
export const removeRecentSearch = (tmdbId: number, mediaType: string) =>
  drop(SEARCHES_KEY, tmdbId, mediaType);

// Titles whose detail page was opened anywhere.
export const getRecentlyViewed = (): TitleHit[] => read(VIEWED_KEY);
export const addRecentlyViewed = (hit: TitleHit) => upsert(VIEWED_KEY, hit);
export const removeRecentlyViewed = (tmdbId: number, mediaType: string) =>
  drop(VIEWED_KEY, tmdbId, mediaType);
