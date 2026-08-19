/**
 * KASET brand mark — a cassette shell.
 *
 * The mark itself is unchanged from the paper era: it was always right, and a
 * cassette is exactly the physical-media object this design direction is about.
 * What changed is its setting — the wordmark now uses the condensed display
 * face and sits tight, like type stamped on a tape label.
 *
 * Drawn in `currentColor` with the hubs punched out; the negative space does
 * the work, so it survives at 16px without a shadow.
 *
 * Keep in step with `app/icon.svg` and `public/logo-badge.svg`.
 */

type LogoProps = {
  /** Rendered width/height in px. Default 28. */
  size?: number;
  className?: string;
  title?: string;
};

export default function Logo({ size = 28, className, title = "Kaset" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      style={{ display: "block" }}
    >
      <rect
        x="1.75" y="6.75" width="28.5" height="18.5" rx="2.25"
        fill="none" stroke="currentColor" strokeWidth="2"
      />
      <circle cx="11" cy="16" r="3.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="21" cy="16" r="3.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M11 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8.5 25.25v1.5M23.5 25.25v1.5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mark + wordmark. The type is condensed display caps, kerned tight rather than
 * tracked out — a tape label, not a luxury brand.
 */
export function Wordmark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Logo size={size} />
      <span
        className="display"
        style={{ fontSize: size * 1.05, letterSpacing: "-0.01em", lineHeight: 0.82 }}
      >
        KASET
      </span>
    </span>
  );
}
