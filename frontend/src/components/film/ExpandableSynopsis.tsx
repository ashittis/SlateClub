"use client";

import { useState } from "react";

/*
  ExpandableSynopsis — clamps a long overview to a few lines with a
  "Read more" toggle (spec §7). Short synopses render in full with no toggle.
*/

interface Props {
  text: string;
  clampLines?: number;
}

export default function ExpandableSynopsis({ text, clampLines = 4 }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Only offer the toggle when the text is long enough to actually clamp.
  const isLong = text.length > 280;

  return (
    <div>
      <p
        className="text-sm leading-relaxed"
        style={
          !expanded && isLong
            ? {
                display: "-webkit-box",
                WebkitLineClamp: clampLines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 min-h-[44px] text-sm font-medium hover:opacity-80"
          style={{ color: "var(--blood-ink)" }}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
