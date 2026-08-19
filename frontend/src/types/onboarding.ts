/**
 * Onboarding option lists.
 *
 * The per-language `color` field is gone — it belonged to SlateClub's pill
 * taxonomy, which a paper UI doesn't use. Selection is now shown by inverting
 * the tile, so the list needs no palette.
 */

export interface LanguageOption {
  code: string;
  label: string;
  /** Endonym — shown under the English label, in monospace. */
  native: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "fa", label: "Persian", native: "فارسی" },
];

/** Streaming services offered in the optional preferences step. */
export const PLATFORM_OPTIONS = [
  { key: "netflix", label: "Netflix" },
  { key: "prime", label: "Prime Video" },
  { key: "mubi", label: "MUBI" },
  { key: "criterion", label: "Criterion" },
  { key: "hotstar", label: "JioHotstar" },
  { key: "appletv", label: "Apple TV+" },
  { key: "max", label: "Max" },
  { key: "sonyliv", label: "SonyLIV" },
] as const;

/** Decade start years offered in the optional preferences step. */
export const DECADE_OPTIONS = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;
