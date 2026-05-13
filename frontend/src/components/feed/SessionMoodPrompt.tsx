"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFeedStore } from "../../stores/feedStore";
import Pill from "@/components/ui/Pill";

const MOODS = [
  { id: "slow_contemplative", label: "Slow & contemplative", emoji: "🌙" },
  { id: "fast_intense", label: "Fast & intense", emoji: "⚡" },
  { id: "funny_light", label: "Funny & light", emoji: "😄" },
  { id: "dark_unsettling", label: "Dark & unsettling", emoji: "🖤" },
  { id: "surprise", label: "Surprise me", emoji: "🎲" },
];

export default function SessionMoodPrompt() {
  const { sessionMood, setSessionMood } = useFeedStore();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || sessionMood) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-6 rounded-xl border border-white/5 p-4"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            What are you in the mood for?
          </h3>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs hover:opacity-80"
            style={{ color: "var(--text-faint)" }}
          >
            Skip
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <Pill
              key={mood.id}
              kind="mood"
              size="sm"
              onClick={() => setSessionMood(mood.id)}
              leading={<span aria-hidden>{mood.emoji}</span>}
            >
              {mood.label}
            </Pill>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
