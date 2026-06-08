"use client";

import { useId } from "react";

interface Props {
  /** 0–1 overlay opacity. Keep low — grain should only show on close inspection. */
  opacity?: number;
  className?: string;
}

/*
  FilmGrain — a fixed, non-interactive filmic noise overlay (SVG feTurbulence),
  desaturated and blended via `overlay`. Cheap: a single static paint.
*/
export default function FilmGrain({ opacity = 0.035, className = "" }: Props) {
  const id = useId().replace(/:/g, "");
  const filterId = `grain-${id}`;

  return (
    <div className={`film-grain ${className}`} aria-hidden style={{ opacity }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  );
}
