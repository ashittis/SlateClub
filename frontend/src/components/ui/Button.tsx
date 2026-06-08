"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "text-white hover:opacity-90 active:scale-[0.98] " +
    "disabled:opacity-50",
  secondary:
    "bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] " +
    "border border-white/10 disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)] " +
    "disabled:opacity-50",
  danger:
    "text-[var(--text-primary)] hover:opacity-90 active:scale-[0.98] " +
    "disabled:opacity-50",
};

const variantInline: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" },
  secondary: {},
  ghost: {},
  danger: { background: "var(--signal-error)" },
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-md gap-1.5",
  md: "px-4 py-2 text-sm rounded-lg gap-2",
  lg: "px-6 py-3 text-base rounded-lg gap-2.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className = "", style, children, disabled, ...rest },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        style={{ ...variantInline[variant], ...style }}
        className={[
          "inline-flex items-center justify-center font-medium transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cta-primary)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-screening)]",
          "disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className,
        ].join(" ")}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
