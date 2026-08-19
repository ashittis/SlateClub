"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

type StarSize = "sm" | "md" | "lg" | "xl";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: StarSize;
  /**
   * Put on the focusable row, so a control elsewhere on the page can send focus
   * here rather than duplicating the rating UI. The film page's action panel
   * does exactly that.
   */
  id?: string;
}

// star + gap in px. `xl` keeps each star ≥44px so quarter-zones stay
// comfortably tappable on touch (per CLAUDE.md touch-target rule).
const sizeMap: Record<StarSize, { star: number; gap: number }> = {
  sm: { star: 16, gap: 2 },
  md: { star: 24, gap: 4 },
  lg: { star: 32, gap: 6 },
  xl: { star: 44, gap: 8 },
};

const TOTAL_STARS = 5;
const STEP = 0.25;
const STAR_BOX = 24; // viewBox units per star cell
const STAR_OUTER = 11; // star tip radius
const STAR_INNER = 5.4; // fuller "proper" star (ratio ~0.49)
// Paper palette: a filled star is oxide red, an empty one is a hairline rule.
// The two-stop gradient survives from SlateClub but now runs within one hue, so
// a half-filled star still reads as one mark rather than two colours.
const GRADIENT_LEFT = "var(--blood-hot)";
const GRADIENT_RIGHT = "var(--blood)";
const STAR_EMPTY = "var(--soot)";
const STAR_STROKE = "var(--edge)";

/** Build a clean 5-point star path centred at (cx, cy). */
function starPath(cx: number, cy = 12, outer = STAR_OUTER, inner = STAR_INNER): string {
  let d = "";
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${k === 0 ? "M" : "L"}${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return `${d}Z`;
}

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  id,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fillRectRef = useRef<SVGRectElement>(null);
  const draggingRef = useRef(false);
  const prevValueRef = useRef(value);
  const baseId = useId();
  const gradId = `${baseId}-grad`;
  const clipId = `${baseId}-clip`;

  const { star: starPx, gap: gapPx } = sizeMap[size];

  // Single coordinate space for the whole row so one gradient spans all stars.
  const gapUnits = (gapPx * STAR_BOX) / starPx;
  const cell = STAR_BOX + gapUnits;
  const totalW = TOTAL_STARS * STAR_BOX + (TOTAL_STARS - 1) * gapUnits;
  const rowWidthPx = TOTAL_STARS * starPx + (TOTAL_STARS - 1) * gapPx;
  const centers = Array.from({ length: TOTAL_STARS }, (_, i) => i * cell + STAR_BOX / 2);

  // Width of the gradient fill clip for a given rating, mapped to each star's
  // VISIBLE width (left tip → right tip) so a quarter fills a real quarter of
  // the star body — not the thin left point. Gap regions carry no geometry.
  const fillWidth = useCallback(
    (v: number) => {
      if (v <= 0) return 0;
      const i = Math.floor(v);
      const f = v - i;
      const half = STAR_BOX / 2;
      const w =
        f === 0
          ? (i - 1) * cell + half + STAR_OUTER // right tip of the last full star
          : i * cell + (half - STAR_OUTER) + f * (2 * STAR_OUTER); // into star i from its left tip
      return Math.max(0, Math.min(totalW, w));
    },
    [cell, totalW],
  );

  // Width on first paint; kept constant so React never fights GSAP for the attr.
  const initialWidthRef = useRef<number | null>(null);
  if (initialWidthRef.current === null) initialWidthRef.current = fillWidth(value);

  const displayValue = hoverValue ?? value;
  const interactive = !readonly && !!onChange;

  // ── GSAP: gradient "flows" left→right to the current value ──────────
  useGSAP(
    () => {
      const rect = fillRectRef.current;
      if (!rect) return;
      const target = fillWidth(displayValue);
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        gsap.set(rect, { attr: { width: target } });
        return;
      }
      gsap.to(rect, {
        attr: { width: target },
        duration: draggingRef.current ? 0.1 : 0.5,
        ease: draggingRef.current ? "power1.out" : "power3.out",
        overwrite: true,
      });
    },
    { dependencies: [displayValue], scope: svgRef },
  );

  // ── GSAP: left→right pop when the committed rating increases ────────
  useGSAP(
    () => {
      const prev = prevValueRef.current;
      prevValueRef.current = value;
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || value <= prev) return;
      const root = svgRef.current;
      if (!root) return;
      const stars = gsap.utils
        .toArray<SVGGElement>(root.querySelectorAll(".mc-star"))
        .slice(0, Math.ceil(value));
      if (!stars.length) return;
      gsap.fromTo(
        stars,
        { scale: 1 },
        {
          scale: 1.18,
          duration: 0.18,
          yoyo: true,
          repeat: 1,
          stagger: 0.05,
          ease: "power2.out",
        },
      );
    },
    { dependencies: [value], scope: svgRef },
  );

  // ── Pointer / keyboard (unchanged math; row container is the slider) ─
  const valueFromPointer = useCallback(
    (clientX: number): number => {
      const row = rowRef.current;
      if (!row) return value;
      const rect = row.getBoundingClientRect();
      const x = clientX - rect.left;
      if (x <= 0) return 0;
      const unit = starPx + gapPx;
      const starIndex = Math.floor(x / unit);
      if (starIndex >= TOTAL_STARS) return TOTAL_STARS;
      const within = Math.min(x - starIndex * unit, starPx);
      const quarter = Math.min(4, Math.max(1, Math.ceil((within / starPx) / STEP)));
      return starIndex + quarter * STEP;
    },
    [starPx, gapPx, value],
  );

  const commit = useCallback(
    (next: number) => {
      if (!onChange) return;
      onChange(next === value ? 0 : next); // tap current value → clear
    },
    [onChange, value],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      setHoverValue(valueFromPointer(e.clientX));
    },
    [interactive, valueFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      // Only track while actively pressing/dragging — plain hover must not
      // change the rating.
      if (draggingRef.current) {
        setHoverValue(valueFromPointer(e.clientX));
      }
    },
    [interactive, valueFromPointer],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!interactive || !draggingRef.current) return;
      draggingRef.current = false;
      const next = valueFromPointer(e.clientX);
      commit(next);
      if (e.pointerType !== "mouse") setHoverValue(null);
    },
    [interactive, valueFromPointer, commit],
  );

  const handlePointerLeave = useCallback(() => {
    if (interactive && !draggingRef.current) setHoverValue(null);
  }, [interactive]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      let next = value;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        next = Math.min(TOTAL_STARS, value + STEP);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        next = Math.max(0, value - STEP);
      }
      if (next !== value && onChange) onChange(next);
    },
    [interactive, onChange, value],
  );

  return (
    <div
      ref={rowRef}
      id={id}
      role={interactive ? "slider" : "img"}
      aria-label={`Rating: ${value} out of ${TOTAL_STARS}`}
      aria-valuemin={0}
      aria-valuemax={TOTAL_STARS}
      aria-valuenow={value}
      aria-valuetext={`${value} stars`}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      onPointerLeave={handlePointerLeave}
      className={`inline-flex ${interactive ? "cursor-pointer" : ""} select-none`}
      style={{ touchAction: interactive ? "none" : undefined }}
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width={rowWidthPx}
        height={starPx}
        viewBox={`0 0 ${totalW} ${STAR_BOX}`}
        aria-hidden
      >
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="12"
            x2={totalW}
            y2="12"
          >
            <stop offset="0%" stopColor={GRADIENT_LEFT} />
            <stop offset="100%" stopColor={GRADIENT_RIGHT} />
          </linearGradient>
          <clipPath id={clipId}>
            <rect ref={fillRectRef} x="0" y="0" height={STAR_BOX} width={initialWidthRef.current} />
          </clipPath>
        </defs>

        {centers.map((cx, i) => {
          const d = starPath(cx);
          return (
            <g
              key={i}
              className="mc-star"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {/* Empty base — outlined, since a pale fill alone would vanish on paper */}
              <path d={d} fill={STAR_EMPTY} stroke={STAR_STROKE} strokeWidth={0.75} />
              {/* Shared-gradient fill, revealed left→right by the clip. No
                  glow — structure in this system comes from hard edges. */}
              <path d={d} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
