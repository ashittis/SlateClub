"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface MoodSliderProps {
  leftEmoji: string;
  rightEmoji: string;
  leftLabel: string;
  rightLabel: string;
  value: number; // -1..1
  onChange: (value: number) => void;
}

/*
  MoodSlider — single axis with two poles. The thumb glows
  green and the active pole label brightens as the user drags
  toward it. Default centre = "I haven't decided".
*/
export default function MoodSlider({
  leftEmoji,
  rightEmoji,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: MoodSliderProps) {
  const [active, setActive] = useState(false);
  const pct = ((value + 1) / 2) * 100; // map -1..1 to 0..100
  const leftStrong = value < -0.15;
  const rightStrong = value > 0.15;

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between text-xs">
        <span
          className="flex items-center gap-1.5 font-medium"
          style={{
            color: leftStrong ? "var(--text-primary)" : "var(--text-faint)",
          }}
        >
          <span aria-hidden className="text-base">
            {leftEmoji}
          </span>
          {leftLabel}
        </span>
        <span
          className="flex items-center gap-1.5 font-medium"
          style={{
            color: rightStrong ? "var(--text-primary)" : "var(--text-faint)",
          }}
        >
          {rightLabel}
          <span aria-hidden className="text-base">
            {rightEmoji}
          </span>
        </span>
      </div>

      <div
        className="relative h-12 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--bg-elevated), var(--bg-card), var(--bg-elevated))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <motion.div
          className="absolute inset-y-0 rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255, 138, 0, 0.18), transparent)",
            left: `${Math.min(pct, 50)}%`,
            right: `${Math.min(100 - pct, 50)}%`,
          }}
        />
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          onMouseDown={() => setActive(true)}
          onMouseUp={() => setActive(false)}
          onTouchStart={() => setActive(true)}
          onTouchEnd={() => setActive(false)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label={`${leftLabel} to ${rightLabel}`}
        />
        <motion.div
          aria-hidden
          className="absolute top-1/2 w-7 h-7 rounded-full pointer-events-none"
          style={{
            background: "var(--cta-primary)",
            border: "3px solid var(--bg-screening)",
            boxShadow: active
              ? "0 0 0 8px rgba(255, 138, 0, 0.18), 0 8px 24px -6px rgba(255, 138, 0, 0.6)"
              : "0 4px 12px -3px rgba(255, 138, 0, 0.4)",
            left: `calc(${pct}% - 14px)`,
            top: "calc(50% - 14px)",
          }}
          animate={{ scale: active ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
        />
      </div>
    </div>
  );
}
