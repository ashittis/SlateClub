/**
 * Client-side search memory (localStorage) — no backend, no account state.
 *
 * Two separate things, deliberately: the *terms* someone typed, and the *films*
 * they opened. Recent searches let you repeat a query; recently viewed lets you
 * get back to a film you didn't act on. The old implementation conflated them
 * into one list of titles, which meant a typed query was never recoverable.
 */

const TERMS_KEY = "kaset.recentSearchTerms";
const VIEWED_KEY = "kaset.recentlyViewedFilms";
const MAX = 8;

export interface ViewedFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: string | null;
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // Quota or private mode — search memory is a nicety, never a failure.
  }
}

// ── Search terms ────────────────────────────────────────────────────────────

export function getRecentSearches(): string[] {
  return read<string>(TERMS_KEY).filter((t) => typeof t === "string" && t.trim());
}

export function addRecentSearch(term: string) {
  const t = term.trim();
  if (!t) return;
  const existing = getRecentSearches().filter(
    (x) => x.toLowerCase() !== t.toLowerCase(),
  );
  write(TERMS_KEY, [t, ...existing]);
}

export function clearRecentSearches() {
  write<string>(TERMS_KEY, []);
}

// ── Recently viewed films ───────────────────────────────────────────────────

export function getRecentlyViewed(): ViewedFilm[] {
  return read<ViewedFilm>(VIEWED_KEY).filter((f) => f && typeof f.tmdbId === "number");
}

export function addRecentlyViewed(film: ViewedFilm) {
  const existing = getRecentlyViewed().filter((f) => f.tmdbId !== film.tmdbId);
  write(VIEWED_KEY, [film, ...existing]);
}

export function clearRecentlyViewed() {
  write<ViewedFilm>(VIEWED_KEY, []);
}
