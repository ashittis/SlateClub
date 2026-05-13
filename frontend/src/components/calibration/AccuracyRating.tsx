"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const RATINGS = [
  { score: 1, emoji: "😞", label: "Terrible" },
  { score: 2, emoji: "😕", label: "Not great" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "🤩", label: "Perfect" },
];

interface Props {
  onRate: (score: number) => void;
}

export default function AccuracyRating({ onRate }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (score: number) => {
    setSelected(score);
    onRate(score);
  };

  return (
    <div className="space-y-3 rounded-lg bg-glass-6 p-4">
      <h3 className="text-center text-lg font-semibold text-text-primary">How are we doing?</h3>
      <p className="text-center text-sm text-glass-40">Rate our recommendations so far</p>

      <div className="flex justify-center gap-3">
        {RATINGS.map(({ score, emoji, label }) => (
          <motion.button
            key={score}
            whileTap={{ scale: 1.2 }}
            animate={selected === score ? { scale: 1.15 } : { scale: 1 }}
            onClick={() => handleSelect(score)}
            className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
              selected === score
                ? "bg-green-glass-20 ring-2 ring-accent-green"
                : "hover:bg-glass-8"
            }`}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-[10px] text-text-subtle">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
