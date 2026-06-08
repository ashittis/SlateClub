"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { OnboardingMovie } from "@/types/onboarding";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";

export default function OriginPage() {
  const router = useRouter();
  const {
    originFilmTmdbId,
    setOriginFilm,
    submitOrigin,
    selectedMovies,
    addMovie,
    submitMovies,
    setStep,
  } = useOnboardingStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OnboardingMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(7);
  }, [setStep]);

  const fetchMovies = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ movies: OnboardingMovie[] }>(
        `/api/onboarding/movies/search?q=${encodeURIComponent(q.trim())}`,
      );
      setResults(data.movies ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchMovies(query), 300);
    return () => clearTimeout(t);
  }, [query, fetchMovies]);

  // The selected origin film (if any) — kept locally so we can render it.
  const [picked, setPicked] = useState<OnboardingMovie | null>(null);

  function pick(m: OnboardingMovie) {
    setPicked(m);
    setOriginFilm(m.tmdbId);
    // Also stash it in selectedMovies so the favourites endpoint
    // gets at least one entry — keeps the cold-start vector populated.
    if (!selectedMovies.some((x) => x.tmdbId === m.tmdbId)) addMovie(m);
  }

  async function proceed(skip: boolean) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!skip && originFilmTmdbId) {
        await submitOrigin();
      }
      // Always submit movies (idempotent on backend) so the user is
      // marked onboarded even if they skip the origin film.
      await submitMovies();
      router.push("/onboarding/ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <StepShell
      title="The first film that made you feel something."
      subtitle="Optional — but it tells us everything."
      footer={
        <>
          {error && (
            <p
              className="mb-3 text-sm text-center"
              style={{ color: "var(--signal-error)" }}
            >
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => proceed(true)}
              disabled={submitting}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              Skip
            </button>
            <div className="flex-1">
              <NextButton
                enabled={!!originFilmTmdbId}
                loading={submitting}
                onClick={() => proceed(false)}
              >
                Continue
              </NextButton>
            </div>
          </div>
        </>
      }
    >
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: "var(--text-faint)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search films"
          autoFocus
          className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {picked && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl p-3 mb-4"
          style={{
            background: "rgba(255, 138, 0, 0.10)",
            border: "1px solid rgba(255, 138, 0, 0.35)",
          }}
        >
          {picked.posterPath && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tmdbImage(picked.posterPath, "w200")}
              alt={picked.title}
              className="w-12 h-18 object-cover rounded"
              style={{ aspectRatio: "2/3" }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {picked.title}
            </p>
            {picked.releaseDate && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {picked.releaseDate.slice(0, 4)}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setPicked(null);
              setOriginFilm(null);
            }}
            className="text-xs"
            style={{ color: "var(--text-faint)" }}
          >
            Change
          </button>
        </motion.div>
      )}

      <div className="flex-1">
        {loading && (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Searching…
          </p>
        )}
        {!loading && results.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {results.map((m) => {
              const selected = m.tmdbId === originFilmTmdbId;
              return (
                <motion.button
                  key={m.tmdbId}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => pick(m)}
                  className="relative aspect-[2/3] rounded-xl overflow-hidden"
                  style={{
                    border: selected
                      ? "2px solid var(--cta-primary)"
                      : "1px solid rgba(255,255,255,0.06)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  {m.posterPath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={tmdbImage(m.posterPath, "w300")}
                      alt={m.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-xs px-2 text-center"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {m.title}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p
            className="text-sm text-center mt-6"
            style={{ color: "var(--text-faint)" }}
          >
            No results.
          </p>
        )}
      </div>
    </StepShell>
  );
}
