"use client";

import { motion } from "framer-motion";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

/*
  Vision shows progress as a thin line of dots — one per step.
  We render dots so the user immediately reads the journey length.
*/
export default function OnboardingProgress({
  currentStep,
  totalSteps,
}: OnboardingProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Step {currentStep} of {totalSteps}
        </span>
      </div>
      <div className="flex w-full items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const idx = i + 1;
          const done = idx < currentStep;
          const active = idx === currentStep;
          return (
            <motion.div
              key={i}
              className="h-1 flex-1 rounded-full"
              initial={false}
              animate={{
                background: done
                  ? "var(--cta-primary)"
                  : active
                    ? "var(--cta-primary)"
                    : "var(--bg-elevated)",
                opacity: active ? 1 : done ? 0.6 : 1,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          );
        })}
      </div>
    </div>
  );
}
