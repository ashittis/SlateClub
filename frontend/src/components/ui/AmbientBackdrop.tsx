"use client";

import { useEffect, useState } from "react";
import { getDominantColor } from "@/lib/poster-color";

/*
  AmbientBackdrop pulls the dominant colour from a poster
  and bleeds it as a soft radial gradient behind the page.
  Used by Home hero + Film Detail. Pass `posterSrc` and
  the gradient morphs whenever it changes.
*/

interface AmbientBackdropProps {
  posterSrc: string | null;
  intensity?: number; // 0..1, default 0.45
}

export default function AmbientBackdrop({
  posterSrc,
  intensity = 0.45,
}: AmbientBackdropProps) {
  const [color, setColor] = useState<string>("#1A1A1F");

  useEffect(() => {
    let cancelled = false;
    if (!posterSrc) {
      setColor("#1A1A1F");
      return;
    }
    getDominantColor(posterSrc).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [posterSrc]);

  const a = Math.max(0, Math.min(1, intensity));
  const stop = hexA(color, a);
  const fade = hexA(color, 0);

  return (
    <div
      aria-hidden
      className="ambient-backdrop"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${stop} 0%, ${fade} 55%), var(--bg-screening)`,
      }}
    />
  );
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
