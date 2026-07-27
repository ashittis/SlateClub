/**
 * SlateClub circular badge logo.
 *
 * Renders the "SLATECLUB · SLATECLUB" stamp as inline SVG so the ring text
 * inherits `currentColor` (set it via the parent's text color) and the coral
 * sparkles pick up the `--cta-primary` palette token. Scale with `size`.
 */
type LogoProps = {
  /** Rendered width/height in px. Default 40. */
  size?: number;
  className?: string;
  /** Accessible label. Default "SlateClub". */
  title?: string;
};

export default function Logo({ size = 40, className, title = "SlateClub" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      style={{ display: "block" }}
    >
      <defs>
        <path id="sc-ringTop" d="M 120 206 A 86 86 0 0 1 120 34 A 86 86 0 0 1 120 206" fill="none" />
        <path id="sc-ringBot" d="M 120 34 A 86 86 0 0 1 120 206 A 86 86 0 0 1 120 34" fill="none" />
      </defs>
      <g
        fill="currentColor"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontWeight={700}
        fontSize={27}
        letterSpacing={9}
      >
        <text textAnchor="middle">
          <textPath href="#sc-ringTop" startOffset="50%">
            SLATECLUB
          </textPath>
        </text>
        <text textAnchor="middle">
          <textPath href="#sc-ringBot" startOffset="50%">
            SLATECLUB
          </textPath>
        </text>
      </g>
      <g
        fill="var(--cta-primary, #F26B4E)"
        fontFamily="Arial, sans-serif"
        fontWeight={700}
        fontSize={19}
        textAnchor="middle"
      >
        <text x={202} y={94}>
          ✳
        </text>
        <text x={38} y={152}>
          ✳
        </text>
      </g>
    </svg>
  );
}
