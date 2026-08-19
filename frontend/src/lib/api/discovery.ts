import { get } from "./client";

export interface EvidenceRef {
  source: "reddit" | "web";
  sourceName: string | null;
  sourceUrl: string | null;
  context: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
}

export interface Recommendation {
  tmdbId: number;
  rank: number;
  confidence: number;
  /** May be empty when no LLM is configured — fall back to showing evidence. */
  reason: string;
  title: string;
  year: string | null;
  posterPath: string | null;
  score: number;
  features: Record<string, number>;
  evidence: EvidenceRef[];
}

export interface DiscoveryResult {
  seed: { tmdbId: number; title: string; year: string | null };
  lens: "community" | "for_you";
  results: Recommendation[];
  /** False when the warmer hasn't reached this film — an honest empty. */
  warm: boolean;
}

/**
 * Evidence-first discovery (KASET.md §9).
 *
 * Two lenses over one pool: `community` answers "what are people recommending
 * after this film?", `for_you` answers "what is most likely to work for you?".
 * Every recommendation carries the evidence behind it.
 */
export const discoveryApi = {
  similar: (tmdbId: number, lens: "community" | "for_you" = "community") =>
    get<DiscoveryResult>(`/api/discovery/similar/${tmdbId}?lens=${lens}`),
};

export const discoveryKeys = {
  similar: (tmdbId: number, lens: string) => ["discovery", tmdbId, lens] as const,
};
