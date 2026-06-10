"use client";

import { usePathname } from "next/navigation";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";
import AmbientGlow from "../../components/ui/AmbientGlow";

const STEP_MAP: Record<string, number> = {
  "/onboarding/welcome": 1,
  "/onboarding/languages": 2,
  "/onboarding/posters": 3,
  "/onboarding/mood": 4,
  "/onboarding/platforms": 5,
  "/onboarding/people": 6,
  "/onboarding/ready": 7,
  // Legacy paths — keep routing but map to nearest valid step
  "/onboarding/origin": 6,
  "/onboarding/movies": 6,
};

const STEP_LABELS: Record<number, string> = {
  1: "Welcome",
  2: "Languages",
  3: "Favourites",
  4: "Taste",
  5: "Platforms",
  6: "Artists",
  7: "Ready",
};

const TOTAL_STEPS = 7;

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
      className="relative min-h-dvh flex flex-col"
      style={{
        background: "var(--bg-screening)",
        color: "var(--text-primary)",
      }}
    >
      <AmbientGlow intensity="low" focusY={12} className="opacity-70" />

      <div className="relative z-10 flex flex-1 flex-col">
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
    </div>
  );
}
