"use client";

import { create } from "zustand";
import type { OnboardingPerson, OnboardingMovie } from "../types/onboarding";
import { apiFetch } from "../lib/api";

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface MoodSliders {
  pacing: number; // -1 slow burn ↔ +1 high octane
  tone: number; //   -1 dark/heavy ↔ +1 light/fun
  realism: number; // -1 grounded ↔ +1 surreal
}

interface OnboardingState {
  // Selections
  selectedLanguages: string[];
  selectedPeople: OnboardingPerson[];
  selectedMovies: OnboardingMovie[];
  posterPicks: number[];
  moodSliders: MoodSliders;
  platforms: string[];
  prefersTheatres: boolean;
  originFilmTmdbId: number | null;
  currentStep: OnboardingStep;

  // Actions
  toggleLanguage: (code: string) => void;
  addPerson: (person: OnboardingPerson) => void;
  removePerson: (tmdbId: number) => void;
  addMovie: (movie: OnboardingMovie) => void;
  removeMovie: (tmdbId: number) => void;
  togglePoster: (tmdbId: number) => void;
  setMood: (axis: keyof MoodSliders, value: number) => void;
  togglePlatform: (key: string) => void;
  setPrefersTheatres: (v: boolean) => void;
  setOriginFilm: (tmdbId: number | null) => void;
  setStep: (step: OnboardingStep) => void;

  // Submissions
  markWelcomed: () => Promise<void>;
  submitLanguages: () => Promise<void>;
  submitPosters: () => Promise<void>;
  submitMood: () => Promise<void>;
  submitPlatforms: () => Promise<void>;
  submitPeople: () => Promise<void>;
  submitOrigin: () => Promise<void>;
  submitMovies: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  selectedLanguages: [],
  selectedPeople: [],
  selectedMovies: [],
  posterPicks: [],
  moodSliders: { pacing: 0, tone: 0, realism: 0 },
  platforms: [],
  prefersTheatres: false,
  originFilmTmdbId: null,
  currentStep: 1,

  toggleLanguage: (code) => {
    set((state) => {
      const exists = state.selectedLanguages.includes(code);
      if (exists) {
        return { selectedLanguages: state.selectedLanguages.filter((l) => l !== code) };
      }
      return { selectedLanguages: [...state.selectedLanguages, code] };
    });
  },

  addPerson: (person) => {
    set((state) => {
      if (state.selectedPeople.some((p) => p.tmdbId === person.tmdbId)) return state;
      return { selectedPeople: [...state.selectedPeople, person] };
    });
  },

  removePerson: (tmdbId) => {
    set((state) => ({
      selectedPeople: state.selectedPeople.filter((p) => p.tmdbId !== tmdbId),
    }));
  },

  addMovie: (movie) => {
    set((state) => {
      if (state.selectedMovies.some((m) => m.tmdbId === movie.tmdbId)) return state;
      return { selectedMovies: [...state.selectedMovies, movie] };
    });
  },

  removeMovie: (tmdbId) => {
    set((state) => ({
      selectedMovies: state.selectedMovies.filter((m) => m.tmdbId !== tmdbId),
    }));
  },

  togglePoster: (tmdbId) => {
    set((state) => {
      const exists = state.posterPicks.includes(tmdbId);
      if (exists) {
        return { posterPicks: state.posterPicks.filter((id) => id !== tmdbId) };
      }
      return { posterPicks: [...state.posterPicks, tmdbId] };
    });
  },

  setMood: (axis, value) => {
    set((state) => ({
      moodSliders: { ...state.moodSliders, [axis]: clamp(value, -1, 1) },
    }));
  },

  togglePlatform: (key) => {
    set((state) => {
      const exists = state.platforms.includes(key);
      if (exists) {
        return { platforms: state.platforms.filter((p) => p !== key) };
      }
      return { platforms: [...state.platforms, key] };
    });
  },

  setPrefersTheatres: (v) => set({ prefersTheatres: v }),

  setOriginFilm: (tmdbId) => set({ originFilmTmdbId: tmdbId }),

  setStep: (step) => set({ currentStep: step }),

  markWelcomed: async () => {
    await apiFetch("/api/onboarding/welcome", { method: "POST" });
  },

  submitLanguages: async () => {
    const { selectedLanguages } = get();
    await apiFetch("/api/onboarding/languages", {
      method: "POST",
      body: JSON.stringify({ languages: selectedLanguages }),
    });
  },

  submitPosters: async () => {
    const { posterPicks } = get();
    await apiFetch("/api/onboarding/posters", {
      method: "POST",
      body: JSON.stringify({ tmdbIds: posterPicks }),
    });
  },

  submitMood: async () => {
    const { moodSliders } = get();
    await apiFetch("/api/onboarding/mood", {
      method: "POST",
      body: JSON.stringify(moodSliders),
    });
  },

  submitPlatforms: async () => {
    const { platforms, prefersTheatres } = get();
    await apiFetch("/api/onboarding/platforms", {
      method: "POST",
      body: JSON.stringify({ platforms, prefersTheatres }),
    });
  },

  submitPeople: async () => {
    const { selectedPeople } = get();
    await apiFetch("/api/onboarding/people", {
      method: "POST",
      body: JSON.stringify({
        people: selectedPeople.map((p) => ({
          tmdbId: p.tmdbId,
          name: p.name,
          profilePath: p.profilePath,
          knownFor: p.knownFor,
        })),
      }),
    });
  },

  submitOrigin: async () => {
    const { originFilmTmdbId } = get();
    if (!originFilmTmdbId) return; // optional step
    await apiFetch("/api/onboarding/origin", {
      method: "POST",
      body: JSON.stringify({ tmdbId: originFilmTmdbId }),
    });
  },

  submitMovies: async () => {
    const { selectedMovies } = get();
    await apiFetch("/api/onboarding/movies", {
      method: "POST",
      body: JSON.stringify({
        movies: selectedMovies.map((m) => ({
          tmdbId: m.tmdbId,
          title: m.title,
          posterPath: m.posterPath,
        })),
      }),
    });
  },
}));

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
