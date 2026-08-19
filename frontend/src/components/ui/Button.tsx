"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
type Shape = "square" | "pill";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * `pill` is for shell chrome ONLY — the top bar's Create button and its
   * search field. Inside the page well, structure comes from hairlines and
   * square edges; a rounded button down there reads as a different design
   * system that wandered in. Defaults to `square` on purpose.
   */
  shape?: Shape;
}

/**
 * The shared button.
 *
 * Square by default: structure in Kaset comes from hairlines, not radius. Only
 * `primary` is filled — if two buttons on a screen are filled in tape red, one
 * of them is wrong.
 *
 * Every size clears 44px in height so a button is tappable wherever it lands.
 */
const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--blood)",
    borderColor: "var(--blood)",
    color: "var(--chalk)",
  },
  secondary: {
    background: "var(--soot)",
    borderColor: "var(--edge)",
    color: "var(--chalk)",
  },
  ghost: {
    background: "transparent",
    borderColor: "transparent",
    color: "var(--xerox)",
  },
  danger: {
    background: "var(--signal-error)",
    borderColor: "var(--signal-error)",
    color: "var(--chalk)",
  },
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[44px] px-3 text-sm gap-1.5",
  md: "min-h-[48px] px-4 text-sm gap-2",
  lg: "min-h-[52px] px-6 text-base gap-2.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      shape = "square",
      className = "",
      style,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled}
      style={{ ...VARIANTS[variant], ...style }}
      className={[
        "inline-flex items-center justify-center border font-medium",
        "transition-opacity duration-150 hover:opacity-85",
        "disabled:pointer-events-none disabled:opacity-40",
        shape === "pill" ? "pill" : "",
        SIZES[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  ),
);

Button.displayName = "Button";

export default Button;
