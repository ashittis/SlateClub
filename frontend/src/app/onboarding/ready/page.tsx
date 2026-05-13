"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useOnboardingStore } from "@/stores/onboardingStore";

interface SamplePoster {
  tmdbId: number;
  posterPath: string | null;
  title: string;
}

interface Summary {
  matchedFilmCount: number;
  twinsWatchingCount: number;
  samplePosters: SamplePoster[];
}

export default function ReadyPage() {
  const router = useRouter();
  const { setStep } = useOnboardingStore();

  useEffect(() => {
    setStep(8);
  }, [setStep]);

  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["onboarding-summary"],
    queryFn: () => apiFetch("/api/onboarding/summary"),
    staleTime: Infinity,
  });

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--bg-screening)" }}
    >
      {/* Logo pulse */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: [0.94, 1.04, 1], opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="display text-3xl font-bold mb-12"
        style={{ color: "var(--text-primary)" }}
      >
        Slate
        <span style={{ color: "var(--cta-primary)" }}>Club</span>
      </motion.div>

      {isLoading || !data ? (
        <motion.div
          className="w-8 h-8 border-2 rounded-full"
          style={{
            borderColor: "var(--cta-primary)",
            borderTopColor: "transparent",
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        />
      ) : (
        <>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="display text-3xl lg:text-5xl font-bold leading-tight max-w-xl"
            style={{ color: "var(--text-primary)" }}
          >
            We found you{" "}
            <span style={{ color: "var(--cta-primary)" }}>
              {data.matchedFilmCount} films
            </span>
            .
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.6 }}
            className="mt-4 text-base"
            style={{ color: "var(--text-muted)" }}
          >
            Your twins are already watching {data.twinsWatchingCount} of them.
          </motion.p>

          {data.samplePosters.length > 0 && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.12, delayChildren: 1.4 } },
              }}
              className="mt-10 flex gap-3 justify-center"
            >
              {data.samplePosters.slice(0, 4).map((p) =>
                p.posterPath ? (
                  <motion.div
                    key={p.tmdbId}
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="w-16 h-24 sm:w-20 sm:h-30 rounded-lg overflow-hidden ring-1 ring-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tmdbImage(p.posterPath, "w200")}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                ) : null,
              )}
            </motion.div>
          )}

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0, duration: 0.6 }}
            onClick={() => router.push("/home")}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="mt-12 px-10 py-3.5 rounded-full text-sm font-semibold"
            style={{
              background: "var(--cta-primary)",
              color: "var(--bg-screening)",
              boxShadow: "0 16px 40px -12px rgba(92,165,114,0.55)",
            }}
          >
            Enter SlateClub →
          </motion.button>
        </>
      )}
    </div>
  );
}
