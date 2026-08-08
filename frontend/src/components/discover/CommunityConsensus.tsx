"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import { titleHref } from "@/lib/titleHref";

interface ConsensusFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  originalLanguage?: string | null;
  matchScore: number;
  explanation: string;
  mentionCount?: number;
  provenance?: string | null;
}

interface ConsensusResponse {
  seed: { tmdbId: number; title: string; mediaType?: string } | null;
  essence?: string | null;
  source: "community" | "essence-fallback";
  answer: ConsensusFilm[];
  forYou?: { headline: string } | null;
  personalized: boolean;
  poolSize: number;
  warming: boolean;
}

/*
  CommunityConsensus — the moat. Not "similar films": this is what the film
  community across Reddit + the web actually recommends after this film, with a
  % grounded in real weighted mention frequency, then re-ranked through the
  viewer's Cinema DNA. Self-contained + tmdbId-gated + null-when-empty, matching
  the other film-detail sections (CulturalContextCard, FilmDiscussSection).
*/
export default function CommunityConsensus({ tmdbId }: { tmdbId: number }) {
  // Default to the personalized ("for you") ordering; toggle shows raw crowd.
  const [personalized, setPersonalized] = useState(true);

  const { data, isLoading } = useQuery<ConsensusResponse>({
    queryKey: ["community-consensus", tmdbId, personalized],
    queryFn: () =>
      apiFetch<ConsensusResponse>("/api/discovery/consensus", {
        method: "POST",
        body: JSON.stringify({ tmdbId, personalized }),
      }),
    enabled: !!tmdbId,
    staleTime: Infinity, // expensive LLM-backed answer — cache hard per session
  });

  if (isLoading) {
    return (
      <div className="my-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: "var(--bg-card)" }}>
            <div className="h-[84px] w-14 shrink-0 animate-pulse rounded-lg" style={{ background: "var(--bg-elevated)" }} />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
              <div className="h-3 w-1/3 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const films = data?.answer ?? [];
  if (!data || films.length === 0) return null;

  const isCommunity = data.source === "community";

  return (
    <div className="my-3 rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Header + provenance badge */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--pill-mood)" }}>
          {isCommunity ? "Community consensus" : "What to watch next"}
        </span>
        {data.warming && (
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            Reading the room…
          </span>
        )}
      </div>

      {/* Essence — the one-sentence thesis */}
      {data.essence && (
        <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <span style={{ color: "var(--text-faint)" }}>Because they share — </span>
          <span className="italic" style={{ color: "var(--text-primary)" }}>{data.essence}</span>
        </p>
      )}

      {/* "For you" callout — the crowd vs your taste */}
      {isCommunity && personalized && data.forYou && (
        <p
          className="mb-3 rounded-lg p-3 text-sm leading-relaxed"
          style={{ background: "rgba(255,122,0,0.08)", border: "1px solid rgba(255,122,0,0.2)", color: "var(--text-primary)" }}
        >
          {data.forYou.headline}
        </p>
      )}

      {/* Community / For-you toggle (community mode only) */}
      {isCommunity && (
        <div className="mb-3 inline-flex rounded-full p-0.5" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {([["For you", true], ["Community", false]] as const).map(([label, val]) => (
            <button
              key={label}
              type="button"
              onClick={() => setPersonalized(val)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
              style={
                personalized === val
                  ? { background: "var(--cta-primary)", color: "var(--bg-screening)" }
                  : { background: "transparent", color: "var(--text-muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.ul
          key={`${personalized}-${data.source}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="space-y-2"
        >
          {films.map((f) => (
            <li key={f.tmdbId}>
              <Link
                href={titleHref(f.tmdbId, "movie")}
                className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-glass-6"
                style={{ background: "var(--bg-screening)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="h-[84px] w-14 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                  {f.posterPath && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={tmdbImage(f.posterPath, "w200")} alt={f.title} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {/* The reason is the headline */}
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {f.explanation}
                  </p>
                  <p className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {f.title}
                    {f.releaseDate ? ` · ${f.releaseDate.slice(0, 4)}` : ""}
                  </p>
                  {f.provenance && (
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {f.provenance}
                    </p>
                  )}
                </div>
                {f.matchScore > 0 && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "rgba(224,160,80,0.15)", color: "var(--pill-mood)" }}
                  >
                    {f.matchScore}%
                  </span>
                )}
              </Link>
            </li>
          ))}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}
