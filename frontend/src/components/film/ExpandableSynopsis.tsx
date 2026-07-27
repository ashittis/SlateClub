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
        className="text-sm leading-relaxed text-glass-55"
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
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-accent-green hover:opacity-80"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
