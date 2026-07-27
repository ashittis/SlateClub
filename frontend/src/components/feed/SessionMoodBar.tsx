"use client";

import { useFeedStore } from "@/stores/feedStore";

// Matches the backend GET /api/recommendations/session-moods vocabulary.
const MOODS: { key: string; label: string }[] = [
  { key: "slow_contemplative", label: "Slow & contemplative" },
  { key: "fast_intense", label: "Fast & intense" },
  { key: "funny_light", label: "Funny & light" },
  { key: "dark_unsettling", label: "Dark & unsettling" },
  { key: "surprise", label: "Surprise me" },
];

/*
  SessionMoodBar — a row of mood chips that reshape the For You feed. Selecting
  one sets the (2h) session mood in feedStore; ForYouGrid reads it inside its
  queryFn, so the feed refetches immediately.
*/
export default function SessionMoodBar() {
  const { sessionMood, setSessionMood } = useFeedStore();

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
      {MOODS.map((m) => {
        const active = sessionMood === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => setSessionMood(active ? null : m.key)}
            aria-pressed={active}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{
              background: active ? "var(--cta-primary)" : "var(--bg-elevated)",
              color: active ? "var(--bg-screening)" : "var(--text-muted)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
