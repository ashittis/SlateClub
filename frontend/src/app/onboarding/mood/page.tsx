"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/stores/onboardingStore";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";
import MoodSlider from "@/components/onboarding/MoodSlider";

export default function MoodPage() {
  const router = useRouter();
  const { moodSliders, setMood, submitMood, setStep } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(4);
  }, [setStep]);

  async function handleContinue() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMood();
      router.push("/onboarding/platforms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <StepShell
      title="Where do you usually land?"
      subtitle="Drag each slider toward what feels right. The middle is fine too."
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
      <div className="space-y-8 mt-4">
        <MoodSlider
          leftEmoji="🌙"
          rightEmoji="⚡"
          leftLabel="Slow Burn"
          rightLabel="High Octane"
          value={moodSliders.pacing}
          onChange={(v) => setMood("pacing", v)}
        />
        <MoodSlider
          leftEmoji="🖤"
          rightEmoji="😄"
          leftLabel="Dark & Heavy"
          rightLabel="Light & Fun"
          value={moodSliders.tone}
          onChange={(v) => setMood("tone", v)}
        />
        <MoodSlider
          leftEmoji="🌍"
          rightEmoji="🎨"
          leftLabel="Grounded Realism"
          rightLabel="Surreal & Stylised"
          value={moodSliders.realism}
          onChange={(v) => setMood("realism", v)}
        />
      </div>
    </StepShell>
  );
}
