"use client";

import { useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { tmdbImage } from "@/lib/api";

gsap.registerPlugin(useGSAP);

/**
 * A one-shot celebration that plays when a user rates or logs a film — the
 * "you did it" moment the app was missing. A checkmark draws inside an elastic
 * ring, the poster pops with a warm glow, and amber particles burst outward.
 *
 * Mount it only while celebrating; it fires once on mount and calls `onDone`
 * when the timeline ends so the parent can unmount it.
 */
export default function LogCompletionBurst({
  posterPath,
  label = "Logged",
  onDone,
}: {
  posterPath?: string | null;
  label?: string;
  onDone: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  // Deterministic particle ring — no Math.random (keeps it stable + SSR-safe).
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const dist = 90 + (i % 3) * 22;
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, i };
      }),
    [],
  );

  useGSAP(
    () => {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      const tl = gsap.timeline({ onComplete: onDone });

      tl.fromTo(
        ".lcb-scrim",
        { opacity: 0 },
        { opacity: 1, duration: 0.18, ease: "power1.out" },
      );

      if (reduce) {
        // Minimal, motion-safe: fade the badge in, hold briefly, fade out.
        tl.fromTo(".lcb-badge", { opacity: 0 }, { opacity: 1, duration: 0.2 })
          .to(".lcb-badge", { opacity: 0, duration: 0.3, delay: 0.7 })
          .to(".lcb-scrim", { opacity: 0, duration: 0.2 }, "<");
        return;
      }

      tl.fromTo(
        ".lcb-ring",
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, ease: "elastic.out(1, 0.55)" },
        0.05,
      )
        .fromTo(
          ".lcb-check",
          { strokeDashoffset: 48 },
          { strokeDashoffset: 0, duration: 0.32, ease: "power2.out" },
          0.28,
        )
        .fromTo(
          ".lcb-poster",
          { scale: 0.6, opacity: 0, y: 12 },
          { scale: 1.06, opacity: 1, y: 0, duration: 0.5, ease: "back.out(2)" },
          0.12,
        )
        .to(".lcb-poster", { scale: 1, duration: 0.25, ease: "power1.inOut" }, ">-0.05")
        .fromTo(
          ".lcb-particle",
          { x: 0, y: 0, scale: 1, opacity: 1 },
          {
            x: (i) => particles[i].x,
            y: (i) => particles[i].y,
            scale: 0,
            opacity: 0,
            duration: 0.7,
            ease: "power2.out",
            stagger: 0.012,
          },
          0.24,
        )
        .fromTo(
          ".lcb-label",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
          0.42,
        )
        // Hold, then fade the whole thing out.
        .to(
          [".lcb-badge", ".lcb-label"],
          { opacity: 0, duration: 0.35, ease: "power1.in" },
          "+=0.75",
        )
        .to(".lcb-scrim", { opacity: 0, duration: 0.3 }, "<");
    },
    { scope: root },
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={root}
      className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center"
      aria-hidden="true"
    >
      <div
        className="lcb-scrim absolute inset-0"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      />

      <div className="lcb-badge relative flex flex-col items-center">
        {/* Poster pop */}
        {posterPath ? (
          <img
            src={tmdbImage(posterPath, "w300")}
            alt=""
            className="lcb-poster mb-5 h-40 w-auto rounded-xl object-cover"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,148,8,0.4), 0 12px 40px rgba(255,148,8,0.35)",
            }}
          />
        ) : null}

        {/* Ring + checkmark */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Particles emit from the ring center */}
          {particles.map((p) => (
            <span
              key={p.i}
              className="lcb-particle absolute h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--cta-primary, #FF9408)" }}
            />
          ))}
          <svg viewBox="0 0 100 100" className="h-24 w-24">
            <circle
              className="lcb-ring"
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="url(#lcb-grad)"
              strokeWidth="5"
              style={{ transformOrigin: "50% 50%" }}
            />
            <path
              className="lcb-check"
              d="M32 51 L45 64 L69 37"
              fill="none"
              stroke="var(--cta-primary, #FF9408)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 48, strokeDashoffset: 48 }}
            />
            <defs>
              <linearGradient id="lcb-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FF9408" />
                <stop offset="100%" stopColor="#95122C" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <span
          className="lcb-label mt-4 text-sm font-semibold tracking-wide"
          style={{ color: "var(--cta-primary, #FF9408)" }}
        >
          {label}
        </span>
      </div>
    </div>,
    document.body,
  );
}
