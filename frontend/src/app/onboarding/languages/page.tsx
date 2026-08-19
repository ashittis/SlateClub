"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { LANGUAGE_OPTIONS } from "@/types/onboarding";

/** Step 1 — the only required step. Everything downstream filters on it. */
export default function LanguagesStep() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { languages, toggleLanguage, submitLanguages, hydrate } = useOnboardingStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const next = async () => {
    setPending(true);
    try {
      await submitLanguages();
      router.push("/onboarding/films");
    } finally {
      setPending(false);
    }
  };

  return (
    <StepShell
      title="What do you watch in?"
      subtitle="Pick every language you'd happily watch a film in. You can change this later."
      footer={
        <NextButton
          onClick={next}
          disabled={languages.length === 0}
          pending={pending}
          label={languages.length === 0 ? "Pick at least one" : "Continue"}
        />
      }
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LANGUAGE_OPTIONS.map((lang) => {
          const on = languages.includes(lang.code);
          return (
            <li key={lang.code}>
              <button
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                aria-pressed={on}
                className="flex min-h-[60px] w-full flex-col items-start justify-center border px-3 py-2 text-left transition-colors"
                style={{
                  borderColor: on ? "var(--chalk)" : "var(--edge)",
                  background: on ? "var(--bleach)" : "var(--soot)",
                  color: on ? "var(--void)" : "var(--chalk)",
                }}
              >
                <span className="text-sm font-medium">{lang.label}</span>
                <span
                  className="meta"
                  style={{ color: on ? "var(--soot)" : "var(--faint)" }}
                >
                  {lang.native}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </StepShell>
  );
}
