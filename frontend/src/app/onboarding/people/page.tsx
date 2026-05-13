"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { OnboardingPerson } from "@/types/onboarding";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";

const MIN_PEOPLE = 1;

export default function PeoplePage() {
  const router = useRouter();
  const { selectedPeople, addPerson, removePerson, submitPeople, setStep } =
    useOnboardingStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OnboardingPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = selectedPeople.length >= MIN_PEOPLE;

  useEffect(() => {
    setStep(6);
  }, [setStep]);

  const fetchPeople = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = q.trim().length >= 2 ? `?q=${encodeURIComponent(q.trim())}` : "";
      const data = await apiFetch<{ people: OnboardingPerson[] }>(
        `/api/onboarding/people/search${params}`,
      );
      setResults(data.people ?? []);
    } catch {
      // keep prior results
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople("");
  }, [fetchPeople]);

  useEffect(() => {
    const t = setTimeout(() => fetchPeople(query), 300);
    return () => clearTimeout(t);
  }, [query, fetchPeople]);

  const isSelected = (id: number) => selectedPeople.some((p) => p.tmdbId === id);

  function handleToggle(person: OnboardingPerson) {
    if (isSelected(person.tmdbId)) removePerson(person.tmdbId);
    else addPerson(person);
  }

  async function handleContinue() {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPeople();
      router.push("/onboarding/origin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <StepShell
      title="Name one director or actor you love."
      subtitle="Just one is enough. We'll find the rest."
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
          <NextButton
            enabled={canContinue}
            loading={submitting}
            onClick={handleContinue}
          >
            {canContinue ? "Next" : "Pick at least 1"}
          </NextButton>
        </>
      }
    >
      {/* Search */}
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
          placeholder="Search artists"
          className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <AnimatePresence>
            {selectedPeople.map((person) => (
              <motion.button
                key={person.tmdbId}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => removePerson(person.tmdbId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(92,165,114,0.18)",
                  border: "1px solid rgba(92,165,114,0.45)",
                  color: "var(--cta-primary)",
                }}
              >
                {person.name}
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="flex-1 -mx-5 px-5 pb-4">
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              className="w-8 h-8 border-2 rounded-full"
              style={{
                borderColor: "var(--cta-primary)",
                borderTopColor: "transparent",
              }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.map((person) => {
              const selected = isSelected(person.tmdbId);
              return (
                <motion.button
                  key={person.tmdbId}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleToggle(person)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className="relative w-24 h-24 rounded-full overflow-hidden transition-all duration-200"
                    style={{
                      border: selected
                        ? "2px solid var(--cta-primary)"
                        : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: selected
                        ? "0 0 0 4px rgba(92,165,114,0.2), 0 12px 28px -10px rgba(92,165,114,0.55)"
                        : "none",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    {person.profilePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={tmdbImage(person.profilePath, "w200")}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-2xl"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {person.name[0]}
                      </div>
                    )}
                    {selected && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(92,165,114,0.3)" }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "var(--cta-primary)" }}
                        >
                          <svg
                            className="w-5 h-5"
                            style={{ color: "var(--bg-screening)" }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <span
                    className="text-xs text-center leading-tight line-clamp-2"
                    style={{
                      color: selected
                        ? "var(--cta-primary)"
                        : "var(--text-muted)",
                    }}
                  >
                    {person.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </StepShell>
  );
}
