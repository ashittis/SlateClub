"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useOnboardingStore } from "@/stores/onboardingStore";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";

interface PosterItem {
  tmdbId: number;
  posterPath: string | null;
  title: string;
}

export default function PostersPage() {
  const router = useRouter();
  const { posterPicks, togglePoster, submitPosters, setStep } =
    useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ posters: PosterItem[] }>({
    queryKey: ["onboarding-poster-set"],
    queryFn: () => apiFetch("/api/onboarding/posters/set?count=18"),
    staleTime: Infinity, // pin the order for the session
  });

  useEffect(() => {
    setStep(3);
  }, [setStep]);

  // Posters arriving from the backend may not have posterPaths populated
  // (TMDB metadata isn't fetched until movie detail). We fall back to a
  // gradient placeholder so the gut test remains usable end-to-end.
  const posters = data?.posters ?? [];
  const canContinue = posterPicks.length >= 3;

  async function handleContinue() {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPosters();
      router.push("/onboarding/mood");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <StepShell
      title="Tap the posters that pull you in."
      subtitle={
        canContinue
          ? `${posterPicks.length} picked — keep going if you want.`
          : "Don't think — just feel. Pick at least 3."
      }
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
            {canContinue ? "Done" : "Pick at least 3"}
          </NextButton>
        </>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl animate-pulse"
              style={{ background: "var(--bg-elevated)" }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {posters.map((p) => {
            const selected = posterPicks.includes(p.tmdbId);
            const src = p.posterPath ? tmdbImage(p.posterPath, "w300") : null;
            return (
              <motion.button
                key={p.tmdbId}
                whileTap={{ scale: 0.95 }}
                onClick={() => togglePoster(p.tmdbId)}
                className="relative aspect-[2/3] rounded-xl overflow-hidden"
                style={{
                  border: selected
                    ? "2px solid var(--cta-primary)"
                    : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: selected
                    ? "0 0 0 4px rgba(255, 138, 0, 0.18), 0 12px 28px -10px rgba(255, 138, 0, 0.55)"
                    : "none",
                  background: "var(--bg-elevated)",
                }}
              >
                {src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={src}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-xs px-2 text-center"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--bg-card), var(--bg-elevated))",
                      color: "var(--text-faint)",
                    }}
                  >
                    {p.title}
                  </div>
                )}
                {selected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-end justify-end p-2"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 50%, rgba(255, 138, 0, 0.35))",
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{
                        background: "var(--cta-primary)",
                        color: "var(--bg-screening)",
                      }}
                    >
                      <svg
                        className="w-4 h-4"
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
                    </span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </StepShell>
  );
}
