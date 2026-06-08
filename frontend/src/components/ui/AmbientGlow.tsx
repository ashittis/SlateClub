"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface Props {
  intensity?: "low" | "normal" | "high";
  /** Vertical focus of the glow, as a CSS % (default 42 — upper-centre). */
  focusY?: number;
  className?: string;
}

const STRENGTH: Record<NonNullable<Props["intensity"]>, number> = {
  low: 0.5,
  normal: 1,
  high: 1.3,
};

/*
  AmbientGlow — a layered "shader" lighting system (not a gradient): a radial
  orange core, a masked sunset column, ribbed vertical light, and a heavy
  vignette so the light appears to emerge from darkness. GSAP drifts the core
  and ribs slowly (Apple-keynote calm); static under reduced-motion.
*/
export default function AmbientGlow({
  intensity = "normal",
  focusY = 42,
  className = "",
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const ribRef = useRef<HTMLDivElement>(null);
  const k = STRENGTH[intensity];
  const at = `50% ${focusY}%`;
  const coreMask = `radial-gradient(40% 55% at ${at}, #000 0%, transparent 75%)`;
  const ribMask = `radial-gradient(30% 45% at ${at}, #000 0%, transparent 70%)`;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(glowRef.current, {
          xPercent: 8,
          duration: 15,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(ribRef.current, {
          x: 10,
          duration: 7,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Layer 1 — radial orange core (drifts) */}
      <div
        ref={glowRef}
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at ${at}, rgba(255,140,0,${0.35 * k}), transparent 60%)` }}
      />
      {/* Layer 3 — sunset column, masked to the bright core */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg,#ff8a00 0%,#ff5e00 40%,#5c1200 100%)",
          opacity: 0.5 * k,
          maskImage: coreMask,
          WebkitMaskImage: coreMask,
        }}
      />
      {/* Layer 2 — ribbed vertical light, masked + drifting */}
      <div
        ref={ribRef}
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(90deg, rgba(255,180,80,${0.12 * k}) 0 8px, transparent 8px 16px)`,
          maskImage: ribMask,
          WebkitMaskImage: ribMask,
        }}
      />
      {/* Layer 4 — heavy vignette: edges fall to near-black */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at ${at}, transparent 40%, rgba(0,0,0,0.85) 100%)` }}
      />
    </div>
  );
}
