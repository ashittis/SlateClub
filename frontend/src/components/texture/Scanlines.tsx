/**
 * CRT scanlines with a drifting tracking bar.
 *
 * The loudest texture in the system, so it is scoped to one place: the VHS
 * chrome around logging. Everywhere else the aesthetic is print, not signal
 * failure — constant distortion just reads as a broken app.
 *
 * The tracking bar is animation, so `prefers-reduced-motion` removes it
 * entirely (globals.css) while the static lines stay.
 */
export default function Scanlines({
  tracking = true,
  className = "",
}: {
  /** The slow drifting brightness band. Off for static contexts. */
  tracking?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <span className="scanlines absolute inset-0" />
      {tracking && (
        <span
          className="tracking-bar absolute inset-x-0 h-16"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(245,242,236,0.07), transparent)",
          }}
        />
      )}
    </span>
  );
}
