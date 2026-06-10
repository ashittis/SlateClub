"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useOnboardingStore } from "@/stores/onboardingStore";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";

const GENRES = [
  { id: "action", label: "Action", emoji: "💥" },
  { id: "thriller", label: "Thriller", emoji: "😰" },
  { id: "drama", label: "Drama", emoji: "🎭" },
  { id: "comedy", label: "Comedy", emoji: "😂" },
  { id: "horror", label: "Horror", emoji: "👻" },
  { id: "sci-fi", label: "Sci-Fi", emoji: "🚀" },
  { id: "romance", label: "Romance", emoji: "💕" },
  { id: "animation", label: "Animation", emoji: "✨" },
  { id: "documentary", label: "Documentary", emoji: "🎥" },
  { id: "crime", label: "Crime", emoji: "🔍" },
  { id: "fantasy", label: "Fantasy", emoji: "🧙" },
  { id: "mystery", label: "Mystery", emoji: "🕵️" },
  { id: "musical", label: "Musical", emoji: "🎵" },
  { id: "historical", label: "Historical", emoji: "🏛️" },
  { id: "superhero", label: "Superhero", emoji: "🦸" },
  { id: "war", label: "War", emoji: "⚔️" },
  { id: "sports", label: "Sports", emoji: "🏆" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
];

const STYLES = [
  { id: "slow-burn", label: "Slow Burn" },
  { id: "fast-paced", label: "Fast Paced" },
  { id: "mind-bending", label: "Mind-Bending" },
  { id: "feel-good", label: "Feel-Good" },
  { id: "dark-gritty", label: "Dark & Gritty" },
  { id: "visually-stunning", label: "Visually Stunning" },
  { id: "character-driven", label: "Character-Driven" },
  { id: "plot-twists", label: "Plot Twists" },
  { id: "based-on-true", label: "Based on True Events" },
  { id: "cult-classic", label: "Cult Classic" },
  { id: "arthouse", label: "Arthouse" },
  { id: "blockbuster", label: "Blockbuster" },
];

export default function MoodPage() {
  const router = useRouter();
  const { setStep } = useOnboardingStore();
  const [genres, setGenres] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(4); }, [setStep]);

  function toggleGenre(id: string) {
    setGenres((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);
  }

  function toggleStyle(id: string) {
    setStyles((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  const canContinue = genres.length >= 1 || styles.length >= 1;

  async function handleContinue() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Store genre/style preferences; also send neutral mood values so
      // the taste engine has a baseline even if the user skips sliders.
      await apiFetch("/api/onboarding/mood", {
        method: "POST",
        body: JSON.stringify({ pacing: 0, tone: 0, realism: 0, genres, styles }),
      });
      router.push("/onboarding/platforms");
    } catch {
      // Non-critical — navigate forward even if this fails.
      router.push("/onboarding/platforms");
    }
  }

  return (
    <StepShell
      title="What do you love to watch?"
      subtitle="Pick your favourite genres and styles. Select as many as you like."
      footer={
        <>
          {error && (
            <p className="mb-3 text-sm text-center" style={{ color: "var(--signal-error)" }}>
              {error}
            </p>
          )}
          <NextButton enabled={canContinue} loading={submitting} onClick={handleContinue}>
            {canContinue ? "Continue" : "Pick at least one"}
          </NextButton>
        </>
      }
    >
      <div className="space-y-6 mt-2">
        {/* Genres */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
            Genres
          </p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => {
              const active = genres.includes(g.id);
              return (
                <motion.button
                  key={g.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => toggleGenre(g.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all cursor-pointer"
                  style={{
                    background: active ? "rgba(255,138,0,0.15)" : "var(--bg-elevated)",
                    border: active ? "1.5px solid var(--cta-primary)" : "1.5px solid rgba(255,255,255,0.07)",
                    color: active ? "var(--cta-primary)" : "var(--text-muted)",
                    boxShadow: active ? "0 0 12px rgba(255,138,0,0.2)" : "none",
                  }}
                >
                  <span>{g.emoji}</span>
                  <span>{g.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Styles */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
            Movie Styles
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => {
              const active = styles.includes(s.id);
              return (
                <motion.button
                  key={s.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => toggleStyle(s.id)}
                  className="px-3 py-2 rounded-full text-sm font-medium transition-all cursor-pointer"
                  style={{
                    background: active ? "rgba(92,165,114,0.15)" : "var(--bg-elevated)",
                    border: active ? "1.5px solid #5CA572" : "1.5px solid rgba(255,255,255,0.07)",
                    color: active ? "#5CA572" : "var(--text-muted)",
                    boxShadow: active ? "0 0 12px rgba(92,165,114,0.2)" : "none",
                  }}
                >
                  {s.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </StepShell>
  );
}
