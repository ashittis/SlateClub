"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboardingStore } from "@/stores/onboardingStore";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";
import { tokens } from "@/lib/design-tokens";

const PLATFORMS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "netflix",   label: "Netflix",     emoji: "🎬" },
  { key: "prime",     label: "Prime Video", emoji: "📦" },
  { key: "mubi",      label: "MUBI",        emoji: "🎞️" },
  { key: "hotstar",   label: "Hotstar",     emoji: "⭐" },
  { key: "disney",    label: "Disney+",     emoji: "🏰" },
  { key: "hbo",       label: "HBO Max",     emoji: "🎭" },
  { key: "apple",     label: "Apple TV+",   emoji: "🍎" },
  { key: "sonyliv",   label: "SonyLIV",     emoji: "📺" },
  { key: "zee5",      label: "Zee5",        emoji: "💫" },
];

export default function PlatformsPage() {
  const router = useRouter();
  const {
    platforms,
    togglePlatform,
    prefersTheatres,
    setPrefersTheatres,
    submitPlatforms,
    setStep,
  } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(5);
  }, [setStep]);

  async function handleContinue() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPlatforms();
      router.push("/onboarding/people");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <StepShell
      title="Which platforms do you have?"
      subtitle="We'll only recommend films you can actually watch."
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
          <NextButton enabled loading={submitting} onClick={handleContinue} />
        </>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PLATFORMS.map((p) => {
          const selected = platforms.includes(p.key);
          return (
            <motion.button
              key={p.key}
              whileTap={{ scale: 0.96 }}
              onClick={() => togglePlatform(p.key)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left"
              style={{
                background: selected
                  ? `linear-gradient(135deg, ${tokens.pill.platform}aa, ${tokens.pill.platform}55)`
                  : "var(--bg-card)",
                border: selected
                  ? `1px solid ${tokens.pill.platform}`
                  : "1px solid rgba(255,255,255,0.06)",
                boxShadow: selected
                  ? `0 12px 24px -10px ${tokens.pill.platform}99`
                  : "none",
              }}
            >
              <span aria-hidden className="text-2xl">
                {p.emoji}
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {p.label}
              </span>
              {selected && (
                <svg
                  className="ml-auto w-4 h-4"
                  style={{ color: "var(--text-primary)" }}
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
              )}
            </motion.button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setPrefersTheatres(!prefersTheatres)}
        className="mt-6 flex items-center gap-3 text-sm self-start"
        style={{
          color: prefersTheatres ? "var(--cta-primary)" : "var(--text-muted)",
        }}
      >
        <span
          className="w-4 h-4 rounded border flex items-center justify-center"
          style={{
            background: prefersTheatres ? "var(--cta-primary)" : "transparent",
            borderColor: prefersTheatres
              ? "var(--cta-primary)"
              : "var(--text-faint)",
          }}
        >
          {prefersTheatres && (
            <svg
              className="w-3 h-3"
              style={{ color: "var(--bg-screening)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={4}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </span>
        I prefer theatres
      </button>
    </StepShell>
  );
}
