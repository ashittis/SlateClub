"use client";

/*
  NumericRating — lightweight IMDb-style 1–10 score for an episode. No giant
  star widget (per gptplan): a compact value pill that opens a 1–10 picker.
*/
interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  /** community average (TMDB), shown beside the user's score. */
  community?: number | null;
}

export default function NumericRating({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: 10 }).map((_, i) => {
        const n = i + 1;
        const on = value != null && Math.round(value) === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(on ? null : n)}
            className="grid h-6 w-6 place-items-center rounded text-[11px] font-semibold transition-opacity hover:opacity-90 cursor-pointer"
            style={{
              background: on ? "var(--cta-gradient)" : "var(--bg-elevated)",
              color: on ? "var(--bg-screening)" : "var(--text-muted)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
