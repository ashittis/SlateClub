"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { LANGUAGE_OPTIONS } from "@/types/onboarding";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";
import { tokens } from "@/lib/design-tokens";

export default function LanguagesPage() {
  const router = useRouter();
  const { selectedLanguages, toggleLanguage, submitLanguages, setStep } =
    useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = selectedLanguages.length >= 1;

  useEffect(() => {
    setStep(2);
  }, [setStep]);

  async function handleContinue() {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitLanguages();
      router.push("/onboarding/posters");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <StepShell
      title="Which languages feel like home?"
      subtitle="Pick at least 1. Not just spoken language — film language."
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
          />
        </>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {LANGUAGE_OPTIONS.map((lang) => {
          const selected = selectedLanguages.includes(lang.code);
          return (
            <motion.button
              key={lang.code}
              whileTap={{ scale: 0.96 }}
              onClick={() => toggleLanguage(lang.code)}
              className="relative h-24 rounded-xl overflow-hidden transition-all duration-200"
              style={{
                background: selected
                  ? `linear-gradient(135deg, ${tokens.pill.language}cc, ${tokens.pill.language}66)`
                  : "var(--bg-card)",
                border: selected
                  ? `1px solid ${tokens.pill.language}`
                  : "1px solid rgba(255,255,255,0.06)",
                boxShadow: selected
                  ? `0 12px 28px -12px ${tokens.pill.language}80`
                  : "none",
              }}
            >
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "var(--text-primary)" }}
                >
                  <svg
                    className="w-4 h-4"
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
                </motion.div>
              )}
              <span
                className="absolute bottom-3 left-3 text-base font-semibold display"
                style={{ color: "var(--text-primary)" }}
              >
                {lang.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </StepShell>
  );
}
