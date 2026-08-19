"use client";

import type { ReactNode } from "react";

/**
 * One icon toggle in the log panel.
 *
 * Icon over a mono caption, in a bordered cell. The caption is not decoration:
 * an icon-only control has no accessible name and no meaning on first use, and
 * a tooltip would be hover-only — which the mobile-parity rule forbids. So the
 * label is always drawn.
 *
 * Set state inverts to `--chalk` fill, matching the watchlist button and the
 * watch-method row rather than inventing a third selected-look. Colour is
 * deliberately not the signal for *which* toggle is on — the icon carries that.
 */
export default function LogToggle({
  icon,
  label,
  pressed,
  onChange,
  layout = "stack",
}: {
  icon: ReactNode;
  label: string;
  pressed: boolean;
  onChange: (next: boolean) => void;
  /**
   * "stack" — icon over caption, for the three-up modifier row.
   * "inline" — icon beside caption, for a lone toggle in the flow of the form.
   */
  layout?: "stack" | "inline";
}) {
  const stacked = layout === "stack";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={
        stacked
          ? "flex min-h-[60px] flex-col items-center justify-center gap-1 border px-2 py-2 transition-colors"
          : "flex min-h-[44px] items-center gap-2 self-start border px-3 py-2 transition-colors"
      }
      style={{
        borderColor: pressed ? "var(--chalk)" : "var(--edge)",
        background: pressed ? "var(--chalk)" : "var(--void)",
        color: pressed ? "var(--soot)" : "var(--xerox)",
      }}
    >
      {icon}
      <span
        className="section-label"
        style={{ color: pressed ? "var(--soot)" : "var(--faint)" }}
      >
        {label}
      </span>
    </button>
  );
}
