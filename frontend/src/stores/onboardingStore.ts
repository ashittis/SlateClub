"use client";

import { create } from "zustand";
import {
  onboardingApi,
  type OnboardingFilm,
  type OnboardingPerson,
  type OnboardingStatus,
} from "@/lib/api/onboarding";

/**
 * Onboarding state.
 *
 * Each step submits on "Next" rather than accumulating a giant payload for the
 * end — so a user who abandons halfway still leaves usable taste signal behind,
 * and `hydrate()` can resume them where they stopped.
 *
 * The old SlateClub store carried poster picks, three mood sliders and an
 * origin film for the 25-dimensional taste vector. That vector is gone, so
 * those fields are too.
 */

interface OnboardingState {
  languages: string[];
  films: OnboardingFilm[];
  people: OnboardingPerson[];
  platforms: string[];
  prefersTheatre: boolean;
  preferredDecades: number[];
  hydrated: boolean;

  hydrate: () => Promise<void>;

  toggleLanguage: (code: string) => void;
  addFilm: (film: OnboardingFilm) => void;
  removeFilm: (tmdbId: number) => void;
  addPerson: (person: OnboardingPerson) => void;
  removePerson: (tmdbId: number) => void;
  togglePlatform: (key: string) => void;
  setPrefersTheatre: (v: boolean) => void;
  toggleDecade: (decade: number) => void;

  submitLanguages: () => Promise<void>;
  submitFilms: () => Promise<void>;
  submitPeople: () => Promise<void>;
  submitPreferences: () => Promise<void>;
  complete: () => Promise<void>;
}

const applyStatus = (s: OnboardingStatus) => ({
  languages: s.languages,
  films: s.films,
  people: s.people,
  platforms: s.preferences.platforms,
  prefersTheatre: s.preferences.prefersTheatre,
  preferredDecades: s.preferences.preferredDecades,
  hydrated: true,
});

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  languages: [],
  films: [],
  people: [],
  platforms: [],
  prefersTheatre: false,
  preferredDecades: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      set(applyStatus(await onboardingApi.status()));
    } catch {
      // Not fatal — the user just starts from empty rather than resuming.
      set({ hydrated: true });
    }
  },

  toggleLanguage: (code) =>
    set((s) => ({
      languages: s.languages.includes(code)
        ? s.languages.filter((l) => l !== code)
        : [...s.languages, code],
    })),

  addFilm: (film) =>
    set((s) =>
      s.films.some((f) => f.tmdbId === film.tmdbId)
        ? s
        : { films: [...s.films, film] },
    ),

  removeFilm: (tmdbId) =>
    set((s) => ({ films: s.films.filter((f) => f.tmdbId !== tmdbId) })),

  addPerson: (person) =>
    set((s) =>
      s.people.some((p) => p.tmdbId === person.tmdbId)
        ? s
        : { people: [...s.people, person] },
    ),

  removePerson: (tmdbId) =>
    set((s) => ({ people: s.people.filter((p) => p.tmdbId !== tmdbId) })),

  togglePlatform: (key) =>
    set((s) => ({
      platforms: s.platforms.includes(key)
        ? s.platforms.filter((p) => p !== key)
        : [...s.platforms, key],
    })),

  setPrefersTheatre: (v) => set({ prefersTheatre: v }),

  toggleDecade: (decade) =>
    set((s) => ({
      preferredDecades: s.preferredDecades.includes(decade)
        ? s.preferredDecades.filter((d) => d !== decade)
        : [...s.preferredDecades, decade],
    })),

  submitLanguages: () => onboardingApi.setLanguages(get().languages).then(() => undefined),
  submitFilms: () => onboardingApi.setFilms(get().films).then(() => undefined),
  submitPeople: () => onboardingApi.setPeople(get().people).then(() => undefined),

  submitPreferences: () => {
    const { platforms, prefersTheatre, preferredDecades } = get();
    return onboardingApi
      .setPreferences({ platforms, prefersTheatre, preferredDecades })
      .then(() => undefined);
  },

  complete: () => onboardingApi.complete().then(() => undefined),
}));
