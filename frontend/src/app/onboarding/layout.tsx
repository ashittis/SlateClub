"use client";

import { usePathname } from "next/navigation";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";

const STEP_MAP: Record<string, number> = {
  "/onboarding/welcome": 1,
  "/onboarding/languages": 2,
  "/onboarding/posters": 3,
  "/onboarding/mood": 4,
  "/onboarding/platforms": 5,
  "/onboarding/people": 6,
  "/onboarding/origin": 7,
  "/onboarding/ready": 8,
  // Legacy alias — old flow used /movies as the final step.
  "/onboarding/movies": 7,
};

const STEP_LABELS: Record<number, string> = {
  1: "Welcome",
  2: "Languages",
  3: "Posters",
  4: "Mood",
  5: "Platforms",
  6: "Artists",
  7: "Origin",
  8: "Ready",
};

const TOTAL_STEPS = 8;

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentStep = STEP_MAP[pathname] ?? 1;
  const showHeader = pathname !== "/onboarding/welcome" && pathname !== "/onboarding/ready";

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{
        background: "var(--bg-screening)",
        color: "var(--text-primary)",
      }}
    >
      {showHeader && (
        <header className="shrink-0 px-5 pt-5 pb-3 lg:px-10 lg:pt-8">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <span
                className="display text-lg font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Slate
                <span style={{ color: "var(--cta-primary)" }}>Club</span>
              </span>
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                {STEP_LABELS[currentStep]}
              </span>
            </div>
            <OnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          </div>
        </header>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
