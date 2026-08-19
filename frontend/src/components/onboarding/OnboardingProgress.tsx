"use client";

/**
 * Step progress as a row of tape-counter segments — filled for done, hollow
 * for pending. Reads as a cassette's run indicator rather than a loading bar.
 */
export default function OnboardingProgress({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${currentStep} of ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <span
          key={i}
          className="h-1 flex-1"
          style={{
            background: i < currentStep ? "var(--blood)" : "var(--edge)",
          }}
        />
      ))}
    </div>
  );
}
