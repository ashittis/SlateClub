"use client";

/*
  RankedOverlay — the editorial "1, 2, 3" numeral overlaid
  on Trending posters. Purposely large and outlined so it
  reads like a magazine layout, not a metadata badge.
*/

interface RankedOverlayProps {
  rank: number;
}

export default function RankedOverlay({ rank }: RankedOverlayProps) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -bottom-3 -left-2 select-none font-display"
      style={{
        fontSize: 88,
        lineHeight: 1,
        fontWeight: 800,
        color: "transparent",
        WebkitTextStroke: "2px var(--text-primary)",
        textShadow: "0 6px 18px rgba(0,0,0,0.45)",
        letterSpacing: "-0.04em",
      }}
    >
      {rank}
    </span>
  );
}
