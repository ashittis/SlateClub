"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useOnboardingStore } from "@/stores/onboardingStore";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";

interface FilmResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
}

interface PickedFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

const MAX_PICKS = 5;

export default function PostersPage() {
  const router = useRouter();
  const { setStep } = useOnboardingStore();
  const [picks, setPicks] = useState<PickedFilm[]>([]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(3); }, [setStep]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery<{ results: FilmResult[] }>({
    queryKey: ["ob-film-search", debounced],
    queryFn: () => apiFetch(`/api/movies/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  function pick(f: FilmResult) {
    if (picks.length >= MAX_PICKS) return;
    if (picks.some((p) => p.tmdbId === f.id)) return;
    setPicks((prev) => [...prev, { tmdbId: f.id, title: f.title, posterPath: f.poster_path }]);
    setQuery("");
    setDropOpen(false);
  }

  function remove(tmdbId: number) {
    setPicks((prev) => prev.filter((p) => p.tmdbId !== tmdbId));
  }

  async function handleContinue() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/onboarding/posters", {
        method: "POST",
        body: JSON.stringify({ tmdbIds: picks.map((p) => p.tmdbId) }),
      });
      router.push("/onboarding/mood");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const canContinue = picks.length >= 1;

  return (
    <StepShell
      title="Add your favourite films."
      subtitle={
        picks.length === 0
          ? "Search for up to 5 films that define your taste."
          : picks.length < MAX_PICKS
          ? `${picks.length} of ${MAX_PICKS} added — keep going or continue.`
          : "Perfect. 5 films added."
      }
      footer={
        <>
          {error && (
            <p className="mb-3 text-sm text-center" style={{ color: "var(--signal-error)" }}>
              {error}
            </p>
          )}
          <NextButton enabled={canContinue} loading={submitting} onClick={handleContinue}>
            {canContinue ? "Continue" : "Add at least 1 film"}
          </NextButton>
        </>
      }
    >
      {/* Search bar */}
      {picks.length < MAX_PICKS && (
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setDropOpen(true); }}
            onFocus={() => setDropOpen(true)}
            onBlur={() => setTimeout(() => setDropOpen(false), 180)}
            placeholder="Search a film…"
            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--text-primary)",
            }}
          />
          <AnimatePresence>
            {dropOpen && debounced.length >= 2 && (results.data?.results?.length ?? 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 z-30 mt-2 rounded-xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
                }}
              >
                {(results.data?.results ?? []).slice(0, 7).map((f) => {
                  const already = picks.some((p) => p.tmdbId === f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(f)}
                      disabled={already}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      <div className="w-8 h-12 rounded-md overflow-hidden shrink-0" style={{ background: "var(--bg-elevated)" }}>
                        {f.poster_path && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tmdbImage(f.poster_path, "w200")} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {f.title}
                        </p>
                        {f.release_date && (
                          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                            {f.release_date.slice(0, 4)}
                          </p>
                        )}
                      </div>
                      {already && (
                        <span className="ml-auto text-xs shrink-0" style={{ color: "var(--cta-primary)" }}>Added</span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Picked films */}
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <AnimatePresence>
            {picks.map((p) => (
              <motion.div
                key={p.tmdbId}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.2 }}
                className="relative w-24 shrink-0"
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden" style={{ border: "2px solid var(--cta-primary)", boxShadow: "0 0 0 4px rgba(255,138,0,0.15)" }}>
                  {p.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImage(p.posterPath, "w300")} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs" style={{ background: "var(--bg-elevated)", color: "var(--text-faint)" }}>
                      {p.title}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(p.tmdbId)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "var(--bg-screening)", border: "1.5px solid rgba(255,255,255,0.15)", color: "var(--text-muted)" }}
                  aria-label={`Remove ${p.title}`}
                >
                  ✕
                </button>
                <p className="mt-1.5 text-xs text-center truncate px-1" style={{ color: "var(--text-faint)" }}>
                  {p.title}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {picks.length === 0 && !query && (
        <p className="text-sm text-center mt-8" style={{ color: "var(--text-faint)" }}>
          Start typing above to search for a film.
        </p>
      )}
    </StepShell>
  );
}
