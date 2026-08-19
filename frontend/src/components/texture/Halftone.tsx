/**
 * Newspaper dot screen.
 *
 * Sits over imagery and large display type — never under body copy, where the
 * dots eat legibility. `coarse` doubles the dot pitch for hero blocks; the
 * default pitch suits smaller panels and loading states.
 */
export default function Halftone({
  coarse = false,
  opacity = 0.4,
  className = "",
}: {
  coarse?: boolean;
  opacity?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`halftone ${coarse ? "halftone-coarse" : ""} pointer-events-none absolute inset-0 ${className}`}
      style={{ opacity }}
    />
  );
}
