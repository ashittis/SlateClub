import { get, post } from "./client";

export interface OnboardingFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year?: string | null;
}

export interface OnboardingPerson {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  knownFor: string;
}

export interface ViewingPreferences {
  platforms: string[];
  prefersTheatre: boolean;
  preferredDecades: number[];
}

export interface OnboardingStatus {
  onboarded: boolean;
  languages: string[];
  films: OnboardingFilm[];
  people: OnboardingPerson[];
  preferences: ViewingPreferences;
}

/**
 * Onboarding — five steps, structured facts only (KASET.md §8).
 *
 * Every setter replaces the whole set rather than appending, so the client can
 * re-submit freely and steps stay idempotent.
 */
export const onboardingApi = {
  status: () => get<OnboardingStatus>("/api/onboarding/status"),

  setLanguages: (languages: string[]) =>
    post<{ ok: boolean }>("/api/onboarding/languages", { languages }),

  searchFilms: (q: string) =>
    get<{ results: OnboardingFilm[] }>(
      `/api/onboarding/films/search?q=${encodeURIComponent(q)}`,
    ),

  setFilms: (films: OnboardingFilm[]) =>
    post<{ ok: boolean }>("/api/onboarding/films", {
      films: films.map((f) => ({
        tmdbId: f.tmdbId,
        title: f.title,
        posterPath: f.posterPath,
      })),
    }),

  searchPeople: (q: string) =>
    get<{ results: OnboardingPerson[] }>(
      `/api/onboarding/people/search?q=${encodeURIComponent(q)}`,
    ),

  setPeople: (people: OnboardingPerson[]) =>
    post<{ ok: boolean }>("/api/onboarding/people", { people }),

  setPreferences: (prefs: ViewingPreferences) =>
    post<{ ok: boolean }>("/api/onboarding/preferences", prefs),

  complete: () => post<{ ok: boolean }>("/api/onboarding/complete"),
};

export const onboardingKeys = {
  status: () => ["onboarding", "status"] as const,
  filmSearch: (q: string) => ["onboarding", "films", q] as const,
  peopleSearch: (q: string) => ["onboarding", "people", q] as const,
};

/** The five steps, in order. Single source of truth for the flow. */
export const ONBOARDING_STEPS = [
  { slug: "languages", label: "Languages", href: "/onboarding/languages" },
  { slug: "films", label: "Films", href: "/onboarding/films" },
  { slug: "people", label: "Cast & crew", href: "/onboarding/people" },
  { slug: "preferences", label: "Preferences", href: "/onboarding/preferences" },
  { slug: "ready", label: "Ready", href: "/onboarding/ready" },
] as const;

export const MAX_FAVOURITE_FILMS = 8;
export const MAX_FAVOURITE_PEOPLE = 8;
