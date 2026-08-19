"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { DECADE_OPTIONS, PLATFORM_OPTIONS } from "@/types/onboarding";

/**
 * Step 4 — how you watch. Explicitly optional (KASET.md §8), so Skip is a
 * first-class button rather than a hidden link.
 */
export default function PreferencesStep() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const {
    platforms,
    prefersTheatre,
    preferredDecades,
    togglePlatform,
    setPrefersTheatre,
    toggleDecade,
    submitPreferences,
    hydrate,
  } = useOnboardingStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const go = async (save: boolean) => {
    setPending(true);
    try {
      if (save) await submitPreferences();
      router.push("/onboarding/ready");
    } finally {
      setPending(false);
    }
  };

  return (
    <StepShell
      title="How you watch"
      subtitle="Optional — it helps us suggest things you can actually get to."
      footer={
        <NextButton
          onClick={() => go(true)}
          onSkip={() => go(false)}
          pending={pending}
        />
      }
    >
      <section>
        <h2 className="section-label">Where you stream</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((p) => (
            <li key={p.key}>
              <Toggle on={platforms.includes(p.key)} onClick={() => togglePlatform(p.key)}>
                {p.label}
              </Toggle>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7">
        <h2 className="section-label">Decades you lean toward</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {DECADE_OPTIONS.map((d) => (
            <li key={d}>
              <Toggle on={preferredDecades.includes(d)} onClick={() => toggleDecade(d)}>
                {d}s
              </Toggle>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7">
        <h2 className="section-label">Theatres</h2>
        <label
          className="mt-2 flex min-h-[56px] cursor-pointer items-center gap-3 border px-3"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          <input
            type="checkbox"
            checked={prefersTheatre}
            onChange={(e) => setPrefersTheatre(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--blood)]"
          />
          <span className="text-sm">I go to the cinema when I can</span>
        </label>
      </section>
    </StepShell>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="min-h-[44px] border px-3 text-sm font-medium transition-colors"
      style={{
        borderColor: on ? "var(--chalk)" : "var(--edge)",
        background: on ? "var(--chalk)" : "var(--soot)",
        color: on ? "var(--void)" : "var(--chalk)",
      }}
    >
      {children}
    </button>
  );
}
