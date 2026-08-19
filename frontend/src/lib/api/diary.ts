import { del, get, patch, post } from "./client";
import type { FilmCard } from "./films";

/** How a viewing happened. Mirrors WATCH_TYPES on the backend. */
export const WATCH_TYPES = ["theatre", "streaming", "tv", "other"] as const;
export type WatchType = (typeof WATCH_TYPES)[number];

export const WATCH_TYPE_LABELS: Record<WatchType, string> = {
  theatre: "Theatre",
  streaming: "Streaming",
  tv: "TV",
  other: "Other",
};

export interface TheatreVisit {
  name: string | null;
  city: string | null;
  format: string | null;
}

export interface DiaryEntry extends FilmCard {
  id: string;
  entryId: string;
  /** Calendar date (YYYY-MM-DD), not a timestamp. */
  watchedOn: string;
  rating: number | null;
  /** Affection, a separate axis from rating — snapshotted per viewing. */
  liked: boolean;
  isRewatch: boolean;
  watchType: WatchType;
  /**
   * Present only for theatre viewings, and only for entries that carry the
   * detail — the log panel records the method alone, so these are populated by
   * the Letterboxd importer and by older entries.
   */
  theatre: TheatreVisit | null;
  /** Normalised lowercase labels on this viewing. */
  tags: string[];
  visibility: "public" | "private";
  review: { id: string; body: string; spoiler: boolean } | null;
}

export interface LogInput {
  /** Internal film uuid, from `filmsApi.status().filmId`. */
  movieId: string;
  watchedOn?: string;
  rating?: number | null;
  liked?: boolean;
  /** Omit to let the server infer it from whether a viewing already exists. */
  isRewatch?: boolean;
  watchType?: WatchType;
  theatreName?: string;
  theatreCity?: string;
  theatreFormat?: string;
  /** Free text; the server lowercases, trims, de-duplicates and caps at 8. */
  tags?: string[];
  visibility?: "public" | "private";
  review?: string;
  reviewSpoiler?: boolean;
}

/**
 * The diary — one row per *viewing*, never per film.
 *
 * The only writer of viewings. Logging the same film twice creates two entries
 * and never overwrites the first (KASET.md §8). Log, rate and review happen in
 * one request because that is how it feels to the user.
 */
export const diaryApi = {
  log: (input: LogInput) => post<DiaryEntry>("/api/diary", input),
  list: (year?: number) =>
    get<DiaryEntry[]>(`/api/diary${year ? `?year=${year}` : ""}`),
  edit: (entryId: string, changes: Partial<Omit<LogInput, "movieId">>) =>
    patch<DiaryEntry>(`/api/diary/${entryId}`, changes),
  remove: (entryId: string) => del<{ ok: boolean }>(`/api/diary/${entryId}`),
};

export const diaryKeys = {
  all: () => ["diary"] as const,
  year: (year?: number) => ["diary", year ?? "all"] as const,
};

/** "12 Mar 2024" — the diary's date format everywhere. */
export function formatViewingDate(isoDate: string): string {
  // Parsed as parts, not `new Date(iso)`: a bare YYYY-MM-DD is treated as UTC
  // midnight and would render as the previous day west of Greenwich.
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Today as YYYY-MM-DD in the viewer's own timezone, not UTC. */
export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** "Theatre · Prithvi, Mumbai · 70mm" — the venue line in the diary. */
export function describeVenue(entry: DiaryEntry): string {
  if (entry.watchType !== "theatre" || !entry.theatre) {
    return WATCH_TYPE_LABELS[entry.watchType];
  }
  const place = [entry.theatre.name, entry.theatre.city].filter(Boolean).join(", ");
  return ["Theatre", place || null, entry.theatre.format].filter(Boolean).join(" · ");
}
