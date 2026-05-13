"use client";

import { useState } from "react";
import { useSocialStore } from "../../stores/socialStore";
import type { MicroFeedbackType } from "../../types/social";

const OPTIONS: { type: MicroFeedbackType; label: string }[] = [
  { type: "not_in_mood", label: "Not in the mood" },
  { type: "too_slow", label: "Too slow" },
  { type: "seen_similar", label: "Seen similar" },
  { type: "more_like_this", label: "More like this" },
];

interface Props {
  movieId: string;
}

export default function MicroFeedbackBar({ movieId }: Props) {
  const [sent, setSent] = useState<string | null>(null);
  const { submitMicroFeedback } = useSocialStore();

  const handleFeedback = async (type: MicroFeedbackType) => {
    await submitMicroFeedback(movieId, type);
    setSent(type);
    setTimeout(() => setSent(null), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => handleFeedback(type)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            sent === type
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-zinc-700 text-zinc-400 hover:border-amber-500 hover:text-amber-400"
          }`}
        >
          {sent === type ? "✓" : label}
        </button>
      ))}
    </div>
  );
}
