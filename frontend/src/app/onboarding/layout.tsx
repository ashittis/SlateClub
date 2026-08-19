"use client";

import { usePathname } from "next/navigation";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { Wordmark } from "@/components/brand/Logo";
import { ONBOARDING_STEPS } from "@/lib/api/onboarding";

/**
 * Onboarding chrome. Steps come from `ONBOARDING_STEPS`, so the flow's length
 * and order are defined in exactly one place — SlateClub kept a separate
 * hand-maintained step map here, and it drifted out of sync with the routes.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const index = ONBOARDING_STEPS.findIndex((s) => pathname.startsWith(s.href));
  const step = index === -1 ? 1 : index + 1;
  const label = ONBOARDING_STEPS[Math.max(index, 0)]?.label ?? "";

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: "var(--void)", color: "var(--chalk)" }}
    >
      <header className="shrink-0 px-5 pb-3 pt-5 lg:px-10 lg:pt-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span aria-label="Kaset" style={{ color: "var(--chalk)" }}>
              <Wordmark size={20} />
            </span>
            <span className="section-label">
              {label} · {step} of {ONBOARDING_STEPS.length}
            </span>
          </div>
          <OnboardingProgress currentStep={step} totalSteps={ONBOARDING_STEPS.length} />
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
