"use client";

export const EPISODE_REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "peak", emoji: "🔥", label: "Peak" },
  { key: "devastating", emoji: "😭", label: "Devastating" },
  { key: "mind_blowing", emoji: "🤯", label: "Mind-blowing" },
  { key: "slow", emoji: "💤", label: "Slow" },
];

interface Props {
  value: string | null;
  onChange: (reaction: string | null) => void;
}

/* Quick episode reactions (no review — per gptplan). */
export default function EpisodeReactionPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {EPISODE_REACTIONS.map((r) => {
        const on = value === r.key;
        return (
          <button
            key={r.key}
            type="button"
            title={r.label}
            onClick={() => onChange(on ? null : r.key)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors cursor-pointer"
            style={{
              background: on ? "rgba(255,255,255,0.10)" : "transparent",
              color: on ? "var(--text-primary)" : "var(--text-faint)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <span>{r.emoji}</span>
            <span className="hidden sm:inline">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}
