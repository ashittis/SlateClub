// ─── Languages ─────────────────────────────────────────────

export interface LanguageOption {
  code: string;
  label: string;
  color: string; // tailwind bg class
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "hi", label: "Hindi", color: "bg-red-500" },
  { code: "en", label: "English", color: "bg-orange-500" },
  { code: "pa", label: "Punjabi", color: "bg-purple-600" },
  { code: "ta", label: "Tamil", color: "bg-amber-500" },
  { code: "te", label: "Telugu", color: "bg-green-500" },
  { code: "ml", label: "Malayalam", color: "bg-teal-500" },
  { code: "mr", label: "Marathi", color: "bg-amber-700" },
  { code: "gu", label: "Gujarati", color: "bg-pink-500" },
  { code: "bn", label: "Bengali", color: "bg-blue-500" },
  { code: "kn", label: "Kannada", color: "bg-red-600" },
  { code: "ko", label: "Korean", color: "bg-indigo-500" },
  { code: "ja", label: "Japanese", color: "bg-rose-600" },
  { code: "fr", label: "French", color: "bg-sky-500" },
  { code: "es", label: "Spanish", color: "bg-yellow-500" },
];

// ─── People ────────────────────────────────────────────────

export interface OnboardingPerson {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  knownFor: string;
  popularity: number;
}

// ─── Movies ────────────────────────────────────────────────

export interface OnboardingMovie {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number;
}

// ─── Status ────────────────────────────────────────────────

export interface OnboardingStatus {
  languagesCompleted: boolean;
  languageCount: number;
  peopleCompleted: boolean;
  peopleCount: number;
  moviesCompleted: boolean;
  movieCount: number;
  onboarded: boolean;
}
