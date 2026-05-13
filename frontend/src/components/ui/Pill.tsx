"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { tokens, type PillKind } from "@/lib/design-tokens";

/*
  The Pill is the silent grammar of the app.
  Colour categorically maps to the slot:
   mood = amber, genre = green, language = tan,
   platform = purple, era = violet, neutral = graphite.
  Users learn the taxonomy without ever reading a label.
*/

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind: PillKind;
  /** Active = saturated fill. Idle = subtle tint + stroke. */
  active?: boolean;
  interactive?: boolean;
  size?: "sm" | "md";
  leading?: ReactNode;
  trailing?: ReactNode;
}

const Pill = forwardRef<HTMLButtonElement, PillProps>(
  (
    {
      kind,
      active = false,
      interactive = true,
      size = "md",
      leading,
      trailing,
      className = "",
      children,
      ...rest
    },
    ref,
  ) => {
    const color = tokens.pill[kind];
    const padding = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
    const fill = active
      ? { background: color, borderColor: color, color: "#0A0A0B" }
      : {
          background: hexA(color, 0.14),
          borderColor: hexA(color, 0.35),
          color: color,
        };

    const Tag = interactive ? "button" : "span";

    return (
      <Tag
        ref={ref as never}
        type={interactive ? "button" : undefined}
        style={fill}
        className={[
          "inline-flex items-center gap-1.5 rounded-full border font-medium",
          "transition-colors duration-150 select-none whitespace-nowrap",
          padding,
          interactive
            ? "hover:opacity-90 active:scale-[0.97] cursor-pointer"
            : "cursor-default",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-screening)]",
          className,
        ].join(" ")}
        {...rest}
      >
        {leading}
        <span>{children}</span>
        {trailing}
      </Tag>
    );
  },
);

Pill.displayName = "Pill";

export default Pill;

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
